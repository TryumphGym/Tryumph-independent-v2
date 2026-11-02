import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  approveCreatorTerms,
  getCreatorAdminReport,
  moderateCreatorOffer,
  requestCreatorRefund,
} from "@/lib/creator.functions";
export function CreatorAdmin() {
  const [report, setReport] = useState<Awaited<
      ReturnType<typeof getCreatorAdminReport>
    > | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [version, setVersion] = useState(""),
    [enabled, setEnabled] = useState(false),
    [approved, setApproved] = useState(false);
  const load = () =>
    void getCreatorAdminReport()
      .then((r) => {
        setReport(r);
        setError("");
      })
      .catch(() =>
        setError(
          "Membership administration unavailable. Administrator access and the staging schema are required.",
        ),
      );
  useEffect(load, []);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      load();
      toast.success("Membership action recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-xl font-bold">
        Optional memberships · review and payments
      </h2>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-outline" onClick={load}>
        Refresh memberships
      </button>
      {report && (
        <>
          <p>
            Latest 100 offers and latest 100 paid invoices. Invoice amounts
            below are actual settled gross and fees, not a forecast or total
            platform revenue.
          </p>
          <p>
            Commercial configuration:{" "}
            {report.terms.enabled ? "Enabled" : "Disabled"} ·{" "}
            {report.terms.commission_bps / 100}% platform ·{" "}
            {report.terms.terms_version ?? "Unapproved"}. Runtime activation is
            separately required.
          </p>
          {report.ownerCanApprove && (
            <fieldset disabled={busy} className="space-y-2">
              <legend className="font-bold">Owner commercial approval</legend>
              <p>
                Trainer 90% / platform 10% after actual payment fees, before
                infrastructure. Existing subscription prices and frozen terms
                remain unchanged. Legal and provider sandbox review are required
                before activation.
              </p>
              <label>
                Terms version
                <input
                  className="field"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </label>
              <label className="block">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />{" "}
                Enable new native checkouts
              </label>
              <label className="block">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                />{" "}
                I approve these commercial terms and have completed the required
                review
              </label>
              <button
                className="btn btn-outline"
                disabled={!approved || version.trim().length < 3}
                onClick={() =>
                  void act(() =>
                    approveCreatorTerms({
                      data: {
                        enabled,
                        commissionBps: 1000,
                        termsVersion: version,
                      },
                    }),
                  )
                }
              >
                Save owner approval
              </button>
            </fieldset>
          )}
          <label className="block">
            Moderation / refund reason
            <textarea
              className="field"
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <h3 className="font-bold">Offers</h3>
          {report.offers.map((o) => (
            <div key={o.trainer_id} className="border-t py-3">
              <p>
                {o.title} · Trainer {o.trainer_id} · $
                {(o.price_cents / 100).toFixed(2)}/month ·{" "}
                {o.blocked ? "Suspended" : o.enabled ? "Offered" : "Disabled"}
              </p>
              <button
                className="btn btn-outline"
                disabled={busy || reason.trim().length < 3}
                onClick={() =>
                  void act(() =>
                    moderateCreatorOffer({
                      data: {
                        trainerId: o.trainer_id,
                        blocked: !o.blocked,
                        reason,
                      },
                    }),
                  )
                }
              >
                {o.blocked
                  ? "Lift suspension"
                  : "Suspend offer and future renewals"}
              </button>
            </div>
          ))}
          <h3 className="font-bold">Paid invoice receipts</h3>
          {report.receipts.map((r) => (
            <div key={r.id} className="border-t py-3">
              <p>
                {r.invoice_id} · ${(r.price_cents / 100).toFixed(2)} gross · $
                {(r.fee_cents / 100).toFixed(2)} actual fees · $
                {(r.refunded_cents / 100).toFixed(2)} refunded ·{" "}
                {r.refund_pending ? "Refund pending" : ""}
              </p>
              <button
                className="btn btn-outline"
                disabled={
                  busy ||
                  reason.trim().length < 3 ||
                  r.refunded_cents >= r.price_cents ||
                  r.refund_pending
                }
                onClick={() =>
                  void act(() =>
                    requestCreatorRefund({ data: { receiptId: r.id, reason } }),
                  )
                }
              >
                Request reviewed refund
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
