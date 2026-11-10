import { useEffect, useRef, useState } from "react";
import {
  loadStripe,
  type Stripe,
  type StripeCardElement,
} from "@stripe/stripe-js";
import { getPrivatePaymentState } from "@/lib/private-payments.functions";

/** This component never creates a payment. It can authenticate only the existing
 * balance intent created after provider-verified two-party attendance. */
export function PrivatePaymentGate({ room }: { room: string }) {
  const [state, setState] = useState(
    "Waiting for both participants to enter. Your balance has not been charged.",
  );
  const [secret, setSecret] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [replace, setReplace] = useState(false);
  const cardHost = useRef<HTMLDivElement>(null),
    card = useRef<StripeCardElement | null>(null),
    stripe = useRef<Stripe | null>(null);
  useEffect(() => {
    let active = true,
      running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const result = await getPrivatePaymentState({ data: { room } });
        if (active) {
          setSecret(result.clientSecret);
          setState(
            result.status === "paid"
              ? "Payment confirmed. Your session is ready."
              : result.status === "payment_failed"
                ? "The balance payment was cancelled. Session access remains locked; cancel from your account for a full refund."
                : result.status === "credential_hold"
                  ? "Session paused for trainer credential verification. You can request a full refund from your account."
                  : result.clientSecret
                    ? "The balance needs your payment confirmation before the session can start."
                    : "Waiting for both participants and confirmed balance payment. Camera and audio remain off until confirmed.",
          );
        }
      } catch {
        if (active)
          setState(
            "Unable to confirm payment status. Session access remains locked. Retry or contact support.",
          );
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [room]);
  useEffect(() => {
    let active = true;
    if (!replace || !secret) return;
    const key = import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"];
    if (!key) {
      setState(
        "Payment confirmation is not configured. Contact support; session access remains locked.",
      );
      return;
    }
    void loadStripe(key).then((s) => {
      if (!s || !active || !cardHost.current) return;
      stripe.current = s;
      card.current = s.elements().create("card");
      card.current.mount(cardHost.current);
    });
    return () => {
      active = false;
      card.current?.destroy();
      card.current = null;
    };
  }, [replace, secret]);
  async function confirm() {
    if (!secret) return;
    setBusy(true);
    try {
      const key = import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"];
      if (!key)
        throw new Error(
          "Payment confirmation is not configured. Contact support.",
        );
      const s = stripe.current ?? (await loadStripe(key));
      if (!s) throw new Error("Cannot load secure payment confirmation.");
      const result = await s.confirmCardPayment(
        secret,
        replace && card.current
          ? { payment_method: { card: card.current } }
          : undefined,
      );
      if (result.error)
        throw new Error(result.error.message ?? "Payment confirmation failed");
      setSecret(null);
      setState("Payment submitted. Waiting for secure confirmation.");
    } catch (e) {
      setState(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="card space-y-3 p-4"
      aria-label="Private session payment"
    >
      <p role="status" className="text-sm">
        {state}
      </p>
      {secret && (
        <>
          <button
            className="btn btn-outline"
            onClick={() => setReplace((x) => !x)}
          >
            {replace ? "Use saved card" : "Use another card"}
          </button>
          {replace && (
            <div
              ref={cardHost}
              className="rounded border bg-white p-4"
              aria-label="Secure card details"
            />
          )}
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? "Confirming…" : "Confirm remaining balance"}
          </button>
        </>
      )}
    </section>
  );
}
