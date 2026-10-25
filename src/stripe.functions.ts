import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TOKEN_PRICE, trainers } from "./data";
import { isTaken, type BusyRow } from "./availability";

function stripe() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Stripe is not configured yet.");
  return new Stripe(key);
}

function appOrigin() {
  if (process.env["APP_ORIGIN"]) return process.env["APP_ORIGIN"];
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "https://home-gym-tribe.lovable.app";
  }
}

export const createTokenCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ tokens: z.number().int().min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const s = stripe();
    const origin = appOrigin();
    const session = await s.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: data.tokens,
          price_data: {
            currency: "usd",
            unit_amount: TOKEN_PRICE * 100,
            product_data: { name: "Tryumph Live Class Token", description: "1 token = 1 live class drop-in. Never expires." },
          },
        },
      ],
      metadata: { type: "tokens", userId: context.userId, tokens: String(data.tokens) },
      success_url: `${origin}/wallet?paid=1`,
      cancel_url: `${origin}/wallet`,
    });
    return { url: session.url };
  });

export const createBookingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ trainerId: z.string(), date: z.string(), time: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const t = trainers.find((x) => x.id === data.trainerId);
    if (!t) throw new Error("Unknown trainer.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^\d{2}:\d{2}$/.test(data.time)) throw new Error("Pick a valid date and time.");
    if (data.date < new Date().toISOString().slice(0, 10)) throw new Error("That date has already passed.");
    // The trainer's calendar is the source of truth: blocked time and paid sessions are off limits.
    const { data: busyRows } = await context.supabase
      .from("trainer_busy")
      .select("day, time, source")
      .eq("trainer_id", data.trainerId)
      .eq("day", data.date);
    if (isTaken(data.trainerId, data.date, data.time, (busyRows ?? []) as BusyRow[])) {
      throw new Error(`${t.name.split(" ")[0]} isn't available at ${data.time} on ${data.date}. Choose another open time.`);
    }
    const s = stripe();
    const origin = appOrigin();
    const session = await s.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(t.rate * 100),
            product_data: { name: `1-on-1 with ${t.name}`, description: `${data.date} at ${data.time} · private video room` },
          },
        },
      ],
      metadata: { type: "booking", userId: context.userId, trainerId: t.id, date: data.date, time: data.time, price: String(t.rate) },
      success_url: `${origin}/trainers/${t.id}?booked=1&date=${encodeURIComponent(data.date)}&time=${encodeURIComponent(data.time)}`,
      cancel_url: `${origin}/trainers/${t.id}`,
    });
    return { url: session.url };
  });
