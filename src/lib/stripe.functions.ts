import { runtimeEnv } from "./runtime-env.server";
import { createServerFn } from "@tanstack/react-start";
import { appOrigin } from "./app-origin.server";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TOKEN_PRICE } from "./data";
import { hasVerifiedCpr } from "./cpr";
import { isTaken, type BusyRow } from "./availability";

function stripe() {
  const key = runtimeEnv("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured yet.");
  return new Stripe(key);
}

export const createTokenCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ tokens: z.number().int().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const s = stripe();
    const origin = appOrigin();
    const session = await s.checkout.sessions.create({
      mode: "payment",
      allowed_payment_method_types: ["card"],
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      line_items: [
        {
          quantity: data.tokens,
          price_data: {
            currency: "usd",
            unit_amount: TOKEN_PRICE * 100,
            product_data: {
              name: "Tryumph Live Class Token",
              description: "1 token = 1 live class drop-in. Never expires.",
            },
          },
        },
      ],
      metadata: {
        type: "tokens",
        userId: context.userId,
        tokens: String(data.tokens),
      },
      success_url: `${origin}/wallet?paid=1`,
      cancel_url: `${origin}/wallet`,
    });
    return { url: session.url };
  });

export const createBookingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        trainerId: z.string().uuid(),
        date: z.string(),
        time: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (context.userId === data.trainerId)
      throw new Error("You cannot book yourself.");
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: profile, error: trainerError } = await supabaseAdmin
      .from("profiles")
      .select("id,name,role,extra")
      .eq("id", data.trainerId)
      .eq("role", "trainer")
      .maybeSingle();
    if (trainerError || !profile) throw new Error("Trainer is not available.");
    const { data: credentials, error: credentialError } = await supabaseAdmin
      .from("certifications")
      .select("name,status,expires,verified_at,verified_by")
      .eq("user_id", data.trainerId);
    if (credentialError || !hasVerifiedCpr(credentials ?? []))
      throw new Error("Trainer CPR/AED verification is required.");
    const extra =
      profile.extra &&
      typeof profile.extra === "object" &&
      !Array.isArray(profile.extra)
        ? (profile.extra as Record<string, unknown>)
        : {};
    const trainerData =
      extra["trainer"] &&
      typeof extra["trainer"] === "object" &&
      !Array.isArray(extra["trainer"])
        ? (extra["trainer"] as Record<string, unknown>)
        : {};
    const rate = Number(trainerData["rate"]);
    if (!Number.isFinite(rate) || rate < 0.5 || rate > 1000)
      throw new Error(
        "This trainer has not published a valid private-session price.",
      );
    const t = {
      id: data.trainerId,
      name: String(profile.name ?? "Trainer"),
      rate,
    };
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date) ||
      !/^\d{2}:\d{2}$/.test(data.time)
    )
      throw new Error("Pick a valid date and time.");
    if (data.date < new Date().toISOString().slice(0, 10))
      throw new Error("That date has already passed.");
    // The trainer's calendar is the source of truth: blocked time and paid sessions are off limits.
    const { data: busyRows, error: busyError } = await context.supabase
      .from("trainer_busy")
      .select("day, time, source")
      .eq("trainer_id", data.trainerId)
      .eq("day", data.date);
    if (busyError) throw new Error("Unable to check trainer availability.");
    if (
      isTaken(
        data.trainerId,
        data.date,
        data.time,
        (busyRows ?? []) as BusyRow[],
      )
    ) {
      throw new Error(
        `${t.name.split(" ")[0]} isn't available at ${data.time} on ${data.date}. Choose another open time.`,
      );
    }
    // Reserve the slot atomically before redirecting to paid checkout.
    const { data: holdId, error: holdError } = await supabaseAdmin.rpc(
      "hold_private_booking",
      {
        p_trainer_id: data.trainerId,
        p_member_id: context.userId,
        p_day: data.date,
        p_time: data.time,
      },
    );
    if (holdError || !holdId)
      throw new Error(
        holdError?.message ?? "That session has just been reserved.",
      );
    const hold = await supabaseAdmin
      .from("private_booking_holds")
      .select("expires_at")
      .eq("id", holdId)
      .single();
    if (hold.error) throw hold.error;
    const s = stripe();
    const origin = appOrigin();
    let session: Stripe.Checkout.Session;
    try {
      session = await s.checkout.sessions.create(
        {
          mode: "payment",
          allowed_payment_method_types: ["card"],
          expires_at:
            Math.floor(new Date(hold.data.expires_at).getTime() / 1000) -
            5 * 60,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(t.rate * 100),
                product_data: {
                  name: `1-on-1 with ${t.name}`,
                  description: `${data.date} at ${data.time} · private video room`,
                },
              },
            },
          ],
          metadata: {
            type: "booking",
            userId: context.userId,
            trainerId: t.id,
            date: data.date,
            time: data.time,
            price: String(t.rate),
            holdId,
          },
          success_url: `${origin}/trainers/${t.id}?booked=1&date=${encodeURIComponent(data.date)}&time=${encodeURIComponent(data.time)}`,
          cancel_url: `${origin}/trainers/${t.id}`,
        },
        { idempotencyKey: `private:${holdId}` },
      );
    } catch (error) {
      await supabaseAdmin.rpc("release_private_hold", {
        p_id: holdId,
        p_member_id: context.userId,
      });
      throw error;
    }
    return { url: session.url };
  });
