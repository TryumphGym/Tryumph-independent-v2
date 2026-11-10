import { useEffect, useState } from "react";
import { getProgramAdminReport } from "@/lib/programs.functions";
import { estimateProgramUsage } from "@/lib/programs";
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
export function ProgramFinancialReport() {
  const [report, setReport] = useState<Awaited<
      ReturnType<typeof getProgramAdminReport>
    > | null>(null),
    [error, setError] = useState("");
  const load = () => {
    void getProgramAdminReport()
      .then((r) => {
        setReport(r);
        setError("");
      })
      .catch(() => setError("Program financial report unavailable"));
  };
  useEffect(() => {
    let active = true;
    void getProgramAdminReport()
      .then((r) => {
        if (active) setReport(r);
      })
      .catch(() => {
        if (active) setError("Program financial report unavailable");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <details>
      <summary className="font-bold">
        Program sales, Tryumph revenue and estimated delivery costs
      </summary>
      <button className="btn btn-ghost my-3" onClick={load}>
        Refresh report
      </button>
      <p className="text-sm">
        Native program sales only. Processing fees use confirmed Stripe charges.
        Allocations precede hosting costs; held refunds/disputes are flagged
        separately and not available for payout. External-store sales are not
        processed or counted here.
      </p>
      <p className="mt-2 text-sm">
        Usage is client-reported active timer time at playback checkpoints, not
        actual Bunny billing or metered bytes. Missing checkpoints, background
        playback and encoding bitrate can change actual consumption. Estimates
        require configured GB/hour, USD/GB and USD/1,000 playback-session rates;
        hosting is never deducted before the trainer split.
      </p>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p className="my-3 text-xs">
            Estimate rates: {report.gbPerHour ?? "not configured"} GB/hour ·{" "}
            {report.usdPerGb ?? "not configured"} USD/GB ·{" "}
            {report.usdPerThousandSessions ?? "not configured"} USD/1,000
            sessions.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Program",
                    "Sales",
                    "Gross",
                    "Refunded",
                    "Processing",
                    "Trainer allocation",
                    "Tryumph allocation",
                    "Held orders",
                    "Usage",
                    "Estimated delivery",
                  ].map((c) => (
                    <th className="p-2" key={c}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => {
                  const estimate = estimateProgramUsage(r, report);
                  return (
                    <tr key={r.program_id} className="border-t">
                      <th className="p-2">{r.title}</th>
                      <td className="p-2">{r.sales}</td>
                      <td className="p-2">{usd(r.gross_cents)}</td>
                      <td className="p-2">{usd(r.refunded_cents)}</td>
                      <td className="p-2">{usd(r.processing_cents)}</td>
                      <td className="p-2">{usd(r.trainer_cents)}</td>
                      <td className="p-2">{usd(r.platform_cents)}</td>
                      <td className="p-2">{r.held_orders}</td>
                      <td className="p-2">
                        {(r.reported_seconds / 3600).toFixed(2)} reported hours
                        · {r.playback_sessions} sessions
                      </td>
                      <td className="p-2">
                        {estimate.estimatedGb === null
                          ? "GB estimate unavailable"
                          : `${estimate.estimatedGb.toFixed(3)} GB estimated`}
                        <br />
                        {estimate.estimatedBandwidthUsd === null
                          ? "Bandwidth estimate unavailable"
                          : `$${estimate.estimatedBandwidthUsd.toFixed(4)} bandwidth estimate`}
                        <br />
                        {estimate.estimatedInfrastructureUsd === null
                          ? "Infrastructure estimate unavailable"
                          : `$${estimate.estimatedInfrastructureUsd.toFixed(4)} infrastructure estimate`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}
