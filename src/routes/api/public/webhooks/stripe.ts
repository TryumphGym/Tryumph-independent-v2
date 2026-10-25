import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

// Stripe calls this when a payment completes. Verifies the signature, then
// credits tokens or confirms the booking. No user session — verified by signature.
export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secretKey = process.env["STRIPE_SECRET_KEY"];
        const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secretKey || !webhookSecret) return new Response("Stripe not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();

        const stripe = new Stripe(secretKey);
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const meta = session.metadata ?? {};
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { sessionFee, split } = await import("@/lib/payouts.server");
          const { gross, fee, chargeId } = await sessionFee(stripe, session);

          if (meta["type"] === "tokens" && meta["userId"] && meta["tokens"]) {
            const n = parseInt(meta["tokens"], 10);
            const { data: profile } = await supabaseAdmin.from("profiles").select("tokens, ledger").eq("id", meta["userId"]).single();
            const prior = (profile?.ledger as Record<string, unknown>[] | null) ?? [];
            if (profile && !prior.some((e) => e["id"] === session.id)) {
              const ledger: Record<string, unknown>[] = [
                { id: session.id, label: `Bought ${n} token${n > 1 ? "s" : ""} ($${n * 5})`, tokens: n, date: new Date().toISOString().slice(0, 10), netPerToken: Math.floor((gross - fee) / n) },
                ...prior,
              ];
              await supabaseAdmin.from("profiles").update({ tokens: (profile.tokens ?? 0) + n, ledger: ledger as never }).eq("id", meta["userId"]);
            }
          }

          if (meta["type"] === "booking" && meta["userId"] && meta["trainerId"]) {
            // Hold the slot on the trainer's calendar so nobody else can book the same time.
            const tSlug = meta["trainerId"] ?? "";
            const tDay = meta["date"] ?? "";
            const tTime = meta["time"] ?? "";
            if (/^\d{4}-\d{2}-\d{2}$/.test(tDay) && /^\d{2}:\d{2}$/.test(tTime)) {
              await supabaseAdmin.from("trainer_busy").upsert(
                { trainer_id: tSlug, day: tDay, time: tTime, source: "booked" },
                { onConflict: "trainer_id,day,time", ignoreDuplicates: true },
              );
            }
            const { data: profile } = await supabaseAdmin.from("profiles").select("bookings").eq("id", meta["userId"]).single();
            const prior = (profile?.bookings as Record<string, unknown>[] | null) ?? [];
            if (profile && !prior.some((b) => b["id"] === session.id)) {
              const bookings: Record<string, unknown>[] = [
                { id: session.id, trainerId: meta["trainerId"], date: meta["date"], time: meta["time"], price: Number(meta["price"]), paid: true },
                ...prior,
              ];
              await supabaseAdmin.from("profiles").update({ bookings: bookings as never }).eq("id", meta["userId"]);
            }
            // Trainer earns 90% of what's left after fees; paid straight to their bank if linked.
            const slug = meta["trainerId"];
            const sp = split(gross, fee, "oneonone");
            const { data: inserted } = await supabaseAdmin.from("trainer_earnings").upsert(
              { trainer_slug: slug, source: "oneonone", ref: session.id, gross_cents: gross, fee_cents: fee, net_cents: sp.net, share_pct: sp.pct, payout_cents: sp.payout },
              { onConflict: "ref", ignoreDuplicates: true },
            ).select("id");
            const { data: acct } = await supabaseAdmin.from("trainer_accounts").select("stripe_account_id, payouts_enabled").or(`slug.eq.${slug},user_id.eq.${/^[0-9a-f-]{36}$/.test(slug) ? slug : "00000000-0000-0000-0000-000000000000"}`).maybeSingle();
            if (inserted?.length && acct?.payouts_enabled && acct.stripe_account_id && sp.payout > 0) {
              const tr = await stripe.transfers.create({ amount: sp.payout, currency: "usd", destination: acct.stripe_account_id, description: "1-on-1 session (after fees)", ...(chargeId ? { source_transaction: chargeId } : {}) });
              await supabaseAdmin.from("trainer_earnings").update({ status: "paid", transfer_id: tr.id }).eq("ref", session.id);
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
