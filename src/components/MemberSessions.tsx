import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SessionJoinButton } from "./SessionJoin";
import { cancelPrivateSession } from "@/lib/session-management.functions";
import type { Tables } from "@/integrations/supabase/types";
import { TRAINING_TIMES } from "@/lib/data";
import { toast } from "sonner";
export function MemberSessions({ trainer = false }: { trainer?: boolean }) {
  const [rows, setRows] = useState<Tables<"private_session_access">[]>([]),
    [requests, setRequests] = useState<Tables<"private_reschedule_requests">[]>(
      [],
    );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [dates, setDates] = useState<Record<string, string>>({}),
    [times, setTimes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return;
    const [result, reschedules] = await Promise.all([
      supabase
        .from("private_session_access")
        .select("*")
        .eq(trainer ? "trainer_id" : "member_id", auth.data.user.id)
        .order("starts_at", { ascending: false }),
      supabase
        .from("private_reschedule_requests")
        .select("*")
        .eq("status", "requested")
        .order("created_at"),
    ]);
    setError(
      result.error || reschedules.error
        ? "Sessions could not be loaded. Please retry."
        : "",
    );
    if (result.data) setRows(result.data);
    if (reschedules.data) setRequests(reschedules.data);
  }, [trainer]);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await fn();
      if (result.error) throw result.error;
      toast.success("Session update saved");
      await load();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : ((e as { message?: string }).message ?? "Unable to update session"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">
        {trainer ? "Booked private sessions" : "Your private sessions"}
      </h2>
      <p className="text-xs text-muted-foreground">
        Times are Central. A 25% deposit reserves a new session. The balance is
        collected after verified two-party waiting-room entry. Existing fully
        paid sessions are never charged again. Unfulfilled
        cancellations/no-shows receive full refunds under launch policy.
      </p>
      {error && (
        <p role="alert">
          {error}
          <button className="underline ml-2" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {!rows.length && !error && (
        <p className="text-sm text-muted-foreground">
          No confirmed sessions yet.
        </p>
      )}
      {rows.map((row) => (
        <article
          className="space-y-3 rounded border p-3 text-sm"
          key={row.checkout_id}
        >
          <p>
            {row.day} at {row.time} · {row.status}
          </p>
          {row.payment_version === 2 && (
            <p>
              Total ${((row.total_cents ?? 0) / 100).toFixed(2)} · Deposit $
              {((row.deposit_cents ?? 0) / 100).toFixed(2)} · Balance $
              {((row.balance_cents ?? 0) / 100).toFixed(2)}
              {row.transfer_used ? " · Deposit transfer used" : ""}
            </p>
          )}
          {["paid", "deposit_paid", "balance_pending"].includes(row.status) && (
            <SessionJoinButton
              trainerId={row.trainer_id}
              date={row.day}
              time={row.time}
              title="Private training"
              hostName="Your trainer"
              isTrainer={trainer}
              accessEndsAt={
                row.payment_version === 2
                  ? new Date(
                      row.both_present_at
                        ? Date.parse(row.both_present_at) + 3600000
                        : Date.parse(row.starts_at) + 15 * 60000,
                    ).toISOString()
                  : undefined
              }
            />
          )}
          {row.payment_version === 2 &&
            row.status === "paid" &&
            !row.delivered_at &&
            row.both_present_at &&
            Date.parse(row.both_present_at) + 3600000 < Date.now() && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void action(() =>
                    supabase.rpc("confirm_private_delivery", {
                      p_booking: row.checkout_id,
                    }),
                  )
                }
              >
                Confirm session received and release earnings
              </button>
            )}
          {!row.delivered_at &&
            [
              "paid",
              "deposit_paid",
              "balance_pending",
              "credential_hold",
            ].includes(row.status) && (
              <button
                className="btn btn-outline"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await cancelPrivateSession({
                      data: { checkoutId: row.checkout_id },
                    });
                    return { error: null };
                  })
                }
              >
                Cancel and request full refund
              </button>
            )}
          {!trainer &&
            row.payment_version === 2 &&
            !row.transfer_used &&
            ["deposit_paid", "credential_hold"].includes(row.status) && (
              <div className="flex flex-wrap items-end gap-2">
                <label>
                  Propose new day
                  <input
                    className="field"
                    type="date"
                    value={dates[row.checkout_id] ?? ""}
                    onChange={(e) =>
                      setDates((d) => ({
                        ...d,
                        [row.checkout_id]: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Central time
                  <select
                    className="field"
                    value={times[row.checkout_id] ?? ""}
                    onChange={(e) =>
                      setTimes((t) => ({
                        ...t,
                        [row.checkout_id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Choose time</option>
                    {TRAINING_TIMES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn-outline"
                  disabled={
                    busy || !dates[row.checkout_id] || !times[row.checkout_id]
                  }
                  onClick={() =>
                    void action(() =>
                      supabase.rpc("request_private_reschedule", {
                        p_booking: row.checkout_id,
                        p_day: dates[row.checkout_id]!,
                        p_time: times[row.checkout_id]!,
                      }),
                    )
                  }
                >
                  Request one-time deposit transfer
                </button>
              </div>
            )}
          {requests
            .filter((r) => r.booking_id === row.checkout_id)
            .map((r) => (
              <div key={r.id} className="rounded border p-2">
                <p>
                  Requested: {r.day} at {r.time}. Same trainer, same agreed
                  price and deposit.
                </p>
                {trainer ? (
                  <div className="flex gap-2">
                    {[true, false].map((approve) => (
                      <button
                        key={String(approve)}
                        className="btn btn-outline"
                        disabled={busy}
                        onClick={() =>
                          void action(() =>
                            supabase.rpc("approve_private_reschedule", {
                              p_request: r.id,
                              p_approve: approve,
                            }),
                          )
                        }
                      >
                        {approve ? "Approve transfer" : "Decline"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>
                    Waiting for your trainer’s decision. Your right to a refund
                    remains available.
                  </p>
                )}
              </div>
            ))}
        </article>
      ))}
    </section>
  );
}
