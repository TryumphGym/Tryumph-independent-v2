import Stripe from "stripe";
import type { RoomServiceClient } from "livekit-server-sdk";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runtimeEnv } from "./runtime-env.server";
import { enablePrivateParticipants } from "./attendance.server";

export function privateStripe() {
  const key = runtimeEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key);
}
export async function intentFee(stripe: Stripe, intentId: string) {
  const intent = await stripe.paymentIntents.retrieve(intentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  if (intent.status !== "succeeded" || intent.currency !== "usd")
    throw new Error("Payment not confirmed");
  const charge = intent.latest_charge;
  if (
    !charge ||
    typeof charge === "string" ||
    !charge.balance_transaction ||
    typeof charge.balance_transaction === "string"
  )
    throw new Error("Settled processing fee not available; retry");
  return {
    intent,
    gross: intent.amount_received,
    fee: charge.balance_transaction.fee,
    refunded: charge.amount_refunded,
  };
}
export async function settlePrivateBalance(stripe: Stripe, intentId: string) {
  const { intent, gross, fee, refunded } = await intentFee(stripe, intentId);
  if (
    intent.metadata["type"] !== "private_balance" ||
    !intent.metadata["bookingId"]
  )
    return;
  const operation = await supabaseAdmin
    .from("private_balance_operations")
    .select("intent_id")
    .eq("booking_id", intent.metadata["bookingId"])
    .single();
  if (
    operation.error ||
    (operation.data.intent_id && operation.data.intent_id !== intentId)
  )
    throw new Error("Balance operation mismatch");
  const result = await supabaseAdmin.rpc("settle_paid_checkout", {
    p_kind: "balance",
    p_refunded: refunded,
    p_args: {
      p_booking: intent.metadata["bookingId"],
      p_intent: intentId,
      p_gross: gross,
      p_fee: fee,
    },
  });
  if (result.error) throw result.error;
}
export async function advancePrivateAttendance(
  room: string,
  present: string[],
  service: RoomServiceClient,
) {
  const match =
    /^oneonone-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/i.exec(room);
  if (!match) return;
  const result = await supabaseAdmin
    .from("private_session_access")
    .select("*")
    .eq("trainer_id", match[1]!)
    .eq("day", match[2]!)
    .eq("time", match[3]!)
    .in("status", ["paid", "deposit_paid", "balance_pending"])
    .maybeSingle();
  if (result.error) throw result.error;
  const b = result.data;
  if (!b || !present.includes(b.trainer_id) || !present.includes(b.member_id))
    return;
  const eligible = await supabaseAdmin.rpc("trainer_is_eligible", {
    p_user_id: b.trainer_id,
    p_live: false,
  });
  if (eligible.error || !eligible.data) {
    await service.deleteRoom(room);
    return;
  }
  if (b.status === "paid") {
    const saved = await supabaseAdmin
      .from("private_session_access")
      .update({ both_present_at: new Date().toISOString() })
      .eq("checkout_id", b.checkout_id)
      .is("both_present_at", null);
    if (saved.error) throw saved.error;
    await enablePrivateParticipants(room, b.member_id, b.trainer_id, service);
    return;
  }
  const presence = await supabaseAdmin.rpc("record_private_both_present", {
    p_booking: b.checkout_id,
  });
  if (presence.error) throw presence.error;
  if (!presence.data) return;
  const claim = await supabaseAdmin.rpc("claim_private_balance", {
    p_booking: b.checkout_id,
  });
  if (claim.error) throw claim.error;
  const operation = claim.data?.[0];
  if (!operation) return;
  const method = await supabaseAdmin
    .from("private_payment_methods")
    .select("customer_id,payment_method_id")
    .eq("booking_id", b.checkout_id)
    .single();
  if (method.error) throw method.error;
  const stripe = privateStripe();
  let intent: Stripe.PaymentIntent;
  if (operation.intent_id)
    intent = await stripe.paymentIntents.retrieve(operation.intent_id);
  else {
    // Stripe idempotency keys may expire after 24 hours. An unresolved create must
    // be reconciled manually after 23h, rather than risk another charge.
    if (Date.now() - Date.parse(operation.created_at) > 23 * 3600000)
      throw new Error(
        "Balance creation requires Stripe reconciliation before retry",
      );
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: b.balance_cents!,
          currency: "usd",
          customer: method.data.customer_id,
          payment_method: method.data.payment_method_id,
          off_session: true,
          confirm: true,
          metadata: { type: "private_balance", bookingId: b.checkout_id },
        },
        { idempotencyKey: operation.operation_key },
      );
    } catch (error) {
      const failed = (error as { payment_intent?: Stripe.PaymentIntent })
        .payment_intent;
      if (!failed) throw error;
      intent = failed;
    }
  }
  const saved = await supabaseAdmin
    .from("private_balance_operations")
    .update({
      intent_id: intent.id,
      status:
        intent.status === "succeeded"
          ? "processing"
          : intent.status === "processing"
            ? "processing"
            : "requires_action",
      lease_until: new Date().toISOString(),
    })
    .eq("booking_id", b.checkout_id);
  if (saved.error) throw saved.error;
  if (intent.status === "succeeded") {
    await settlePrivateBalance(stripe, intent.id);
    const current = await service.listParticipants(room);
    if (
      current.some((p) => p.identity === b.member_id) &&
      current.some((p) => p.identity === b.trainer_id)
    ) {
      const access = await supabaseAdmin
        .from("private_session_access")
        .select("status")
        .eq("checkout_id", b.checkout_id)
        .single();
      if (access.data?.status === "paid")
        await enablePrivateParticipants(
          room,
          b.member_id,
          b.trainer_id,
          service,
        );
    }
  }
}

/** Handles participants who entered early and remain present at the scheduled start.
 * Only provider presence and the scheduled job initiate this transition. */
export async function advancePresentPrivateSessions() {
  const now = new Date().toISOString();
  const bookings = await supabaseAdmin
    .from("private_session_access")
    .select("trainer_id,day,time")
    .in("status", ["deposit_paid", "balance_pending"])
    .lte("starts_at", now)
    .gte("starts_at", new Date(Date.now() - 15 * 60000).toISOString())
    .limit(100);
  if (bookings.error) throw bookings.error;
  if (!bookings.data.length) return;
  const { roomService } = await import("./attendance.server");
  const service = roomService();
  for (const b of bookings.data) {
    const room = `oneonone-${b.trainer_id}-${b.day}-${b.time}`;
    try {
      const present = await service.listParticipants(room);
      await advancePrivateAttendance(
        room,
        present.map((p) => p.identity),
        service,
      );
    } catch (error) {
      if ((error as { code?: string }).code !== "not_found")
        console.error("Private attendance maintenance will retry", error);
    }
  }
}
