import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Polling reconciles an EXISTING intent; a click/poll can never initiate a charge. */
export const getPrivatePaymentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        room: z
          .string()
          .regex(/^oneonone-[0-9a-f-]{36}-\d{4}-\d{2}-\d{2}-\d{2}:\d{2}$/i),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const match =
      /^oneonone-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/.exec(
        data.room,
      )!;
    const booking = await supabaseAdmin
      .from("private_session_access")
      .select("*")
      .eq("trainer_id", match[1]!)
      .eq("day", match[2]!)
      .eq("time", match[3]!)
      .in("status", [
        "paid",
        "deposit_paid",
        "balance_pending",
        "credential_hold",
      ])
      .maybeSingle();
    const b = booking.data;
    if (
      booking.error ||
      !b ||
      ![b.member_id, b.trainer_id].includes(context.userId)
    )
      throw new Error("Not your session");
    const eligible = await supabaseAdmin.rpc("trainer_is_eligible", {
      p_user_id: b.trainer_id,
      p_live: false,
    });
    if (eligible.error || !eligible.data || b.status === "credential_hold")
      return { status: "credential_hold", clientSecret: null };
    const { privateStripe, settlePrivateBalance } =
      await import("./private-payments.server");
    const operation = await supabaseAdmin
      .from("private_balance_operations")
      .select("intent_id")
      .eq("booking_id", b.checkout_id)
      .maybeSingle();
    if (operation.error) throw operation.error;
    let clientSecret: string | null = null;
    if (operation.data?.intent_id) {
      const stripe = privateStripe();
      const intent = await stripe.paymentIntents.retrieve(
        operation.data.intent_id,
      );
      if (intent.status === "canceled")
        return { status: "payment_failed", clientSecret: null };
      if (intent.status === "succeeded")
        await settlePrivateBalance(stripe, intent.id);
      else if (
        context.userId === b.member_id &&
        [
          "requires_action",
          "requires_payment_method",
          "requires_confirmation",
        ].includes(intent.status)
      )
        clientSecret = intent.client_secret;
    }
    const current = await supabaseAdmin
      .from("private_session_access")
      .select("status")
      .eq("checkout_id", b.checkout_id)
      .single();
    if (current.error) throw current.error;
    if (
      current.data.status === "paid" &&
      Date.now() >= Date.parse(b.starts_at) - 600000 &&
      Date.now() <=
        (b.both_present_at
          ? Date.parse(b.both_present_at) + 3600000
          : Date.parse(b.starts_at) + 3600000)
    ) {
      const { roomService, enablePrivateParticipants } =
        await import("./attendance.server");
      const service = roomService();
      const present = await service.listParticipants(data.room);
      if (
        present.some((p) => p.identity === b.member_id) &&
        present.some((p) => p.identity === b.trainer_id)
      )
        await enablePrivateParticipants(
          data.room,
          b.member_id,
          b.trainer_id,
          service,
        );
    }
    return { status: current.data.status, clientSecret };
  });
