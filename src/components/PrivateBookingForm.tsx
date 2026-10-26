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
    if (!date || !time) return void toast.error("Choose a day and time");
    setSubmitting(true);
    try {
      const { url } = await createBookingCheckout({
        data: { trainerId, date, time },
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
      <button
        className="btn btn-primary"
        disabled={submitting || loading || !date || !time}
        onClick={() => void book()}
      >
        {submitting
          ? "Opening secure checkout…"
          : `Book for $${rate.toFixed(2)}`}
      </button>
      <p className="text-xs text-muted-foreground">
        Your booking is confirmed only after payment succeeds. A video room
        opens shortly before the scheduled session.
      </p>
    </section>
  );
}
