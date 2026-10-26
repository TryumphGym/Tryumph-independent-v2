import { createServerFn } from "@tanstack/react-start";
import { appOrigin } from "./app-origin.server";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runtimeEnv } from "@/lib/runtime-env.server";

/** Checkout for a particular persisted class; the webhook alone grants room access. */
export const createLiveClassCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: session, error } = await supabaseAdmin
      .from("live_sessions")
      .select("id,title,trainer_id,starts_at,status")
      .eq("id", data.sessionId)
      .single();
    if (
      error ||
      !session ||
      !["scheduled", "live"].includes(session.status) ||
      new Date(session.starts_at).getTime() <= Date.now()
    )
      throw new Error("Class is unavailable");
    const eligible = await supabaseAdmin.rpc("trainer_is_eligible", {
      p_user_id: session.trainer_id,
      p_live: true,
    });
    if (eligible.error || !eligible.data)
      throw new Error("Trainer is not currently eligible");
    const { data: existing } = await supabaseAdmin
      .from("live_room_access")
      .select("id")
      .eq("session_id", session.id)
      .eq("user_id", context.userId)
      .eq("status", "paid")
      .maybeSingle();
    if (existing) return { alreadyBooked: true, url: null };
    const key = runtimeEnv("STRIPE_SECRET_KEY");
    if (!key) throw new Error("Stripe not configured");
    const stripe = new Stripe(key);
    const origin = appOrigin();
    const intent = await supabaseAdmin.rpc("get_live_checkout_intent", {
      p_user_id: context.userId,
      p_session_id: session.id,
    });
    if (intent.error || !intent.data)
      throw new Error("Unable to reserve checkout");
    const intentRow = await supabaseAdmin
      .from("live_checkout_intents")
      .select("expires_at")
      .eq("id", intent.data)
      .single();
    if (intentRow.error) throw intentRow.error;
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        expires_at: Math.floor(
          new Date(intentRow.data.expires_at).getTime() / 1000,
        ),
        allowed_payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 500,
              product_data: {
                name: String(session.title ?? "Tryumph live class"),
              },
            },
          },
        ],
        metadata: {
          type: "live",
          userId: context.userId,
          sessionId: session.id,
        },
        success_url: `${origin}/live?booked=1`,
        cancel_url: `${origin}/live?cancelled=1`,
      },
      { idempotencyKey: `live:${intent.data}` },
    );
    return { alreadyBooked: false, url: checkout.url };
  });

/** Redeem one Stripe-funded wallet token atomically; only the server can grant room access. */
export const redeemLiveClassToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("redeem_paid_live_token", {
      p_user_id: context.userId,
      p_session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
