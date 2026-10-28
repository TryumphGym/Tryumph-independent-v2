import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createBookingCheckout } from "@/lib/stripe.functions";
import { TRAINING_TIMES } from "@/lib/data";
import { toast } from "sonner";

type Busy = { day: string; time: string; source: string };
/** Sells only verified trainer sessions; final price, CPR, slot hold and payment are checked on server. */
export function PrivateBookingForm({
  trainerId,
  rate,
}: {
  trainerId: string;
  rate: number;
}) {
  const [date, setDate] = useState(""),
    [time, setTime] = useState("");
  const [busy, setBusy] = useState<Busy[]>([]),
    [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const deposit = Math.floor((Math.round(rate * 100) + 2) / 4) / 100;
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!date) {
      setBusy([]);
      return;
    }
    let active = true;
    setLoading(true);
    void supabase
      .from("trainer_busy")
      .select("day,time,source")
      .eq("trainer_id", trainerId)
      .eq("day", date)
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error) {
          toast.error("Cannot load the trainer calendar");
          setBusy([{ day: date, time: "ALL", source: "unavailable" }]);
        } else setBusy((data ?? []) as Busy[]);
      });
    return () => {
      active = false;
    };
  }, [trainerId, date]);
  const book = async () => {
    if (!date || !time || !consent)
      return void toast.error("Choose a day and time");
    setSubmitting(true);
    try {
      const { url } = await createBookingCheckout({
        data: { trainerId, date, time, terms: "private-deposit-v1" },
      });
      if (!url) throw new Error("Checkout unavailable");
      window.location.assign(url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to reserve that time",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Book a private 1-on-1</h2>
      <p className="text-sm text-muted-foreground">
        ${rate.toFixed(2)} per session · all times Central (America/Chicago).
        Payment is processed securely by Stripe.
      </p>
      <label className="block text-sm">
        Day
        <input
          type="date"
          className="field mt-1"
          min={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setTime("");
          }}
        />
      </label>
      <label className="block text-sm">
        Start time (Central)
        <select
          className="field mt-1"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={!date || loading}
        >
          <option value="">Choose an open time</option>
          {TRAINING_TIMES.filter(
            (t) => !busy.some((b) => b.time === t || b.time === "ALL"),
          ).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm">
        ${deposit.toFixed(2)} deposit (25%) now. ${(rate - deposit).toFixed(2)}{" "}
        balance only after both you and your trainer enter the waiting room and
        your payment succeeds. No recurring charge.
      </p>
      <p className="text-xs text-muted-foreground">
        Cancel any unfulfilled session for a full refund under our launch
        policy. A trainer may instead approve your requested reschedule once
        using the same deposit. If either participant is absent after 15
        minutes, or credentials prevent the session, a full refund is queued.
        Statutory rights remain available.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I agree to pay the deposit and authorize Stripe to save my card for the
        disclosed remaining balance when both participants enter. Extra
        authentication may be required before session access.
      </label>
      <button
        className="btn btn-primary"
        disabled={submitting || loading || !date || !time || !consent}
        onClick={() => void book()}
      >
        {submitting
          ? "Opening secure checkout…"
          : `Pay $${deposit.toFixed(2)} deposit`}
      </button>
      <p className="text-xs text-muted-foreground">
        Your booking is reserved after the deposit succeeds. A waiting room
        opens shortly before the scheduled session.
      </p>
    </section>
  );
}
