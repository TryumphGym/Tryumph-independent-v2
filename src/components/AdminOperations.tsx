import { useEffect, useState } from "react";
import { getOperations } from "@/lib/admin-operations.functions";
import { retryPendingRefunds } from "@/lib/session-management.functions";
import { toast } from "sonner";
export function AdminOperations() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getOperations>
  > | null>(null);
  const load = async () => {
    try {
      setData(await getOperations());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Cannot read operational status",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Payments and operational records</h2>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={() => void load()}>
          Refresh
        </button>
        <button
          className="btn btn-outline"
          onClick={() =>
            void retryPendingRefunds()
              .then((r) => {
                toast.success(`${r.completed} refunds confirmed`);
                return load();
              })
              .catch((e) =>
                toast.error(
                  e instanceof Error ? e.message : "Refund retry failed",
                ),
              )
          }
        >
          Retry queued refunds
        </button>
      </div>
      <h3 className="font-semibold">Earnings and reversals</h3>
      <ul className="max-h-64 overflow-auto text-sm">
        {data?.earnings.map((row) => (
          <li className="border-b py-2" key={row.id}>
            {row.source} · ${(row.payout_cents / 100).toFixed(2)} original share
            · {row.status} · ${(row.reversal_target_cents / 100).toFixed(2)}{" "}
            reversal target
          </li>
        ))}
      </ul>
      <h3 className="font-semibold">Refund requests</h3>
      <ul className="text-sm">
        {data?.refunds.map((row) => (
          <li key={row.checkout_id}>
            {row.reason} · {row.completed_at ? "Confirmed by Stripe" : "Queued"}
          </li>
        ))}
      </ul>
      <h3 className="font-semibold">Payment disputes</h3>
      <ul className="text-sm">
        {data?.disputes.map((row) => (
          <li key={row.id}>
            {row.id} · {row.status} ·{" "}
            {row.reconciled ? "Reconciled" : "Awaiting reconciliation"}
          </li>
        ))}
      </ul>
    </section>
  );
}
