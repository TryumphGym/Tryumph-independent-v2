import { useUserId } from "@/lib/community";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { programSchema } from "@/lib/programs";
import {
  approveProgramTerms,
  getProgramCommercialTerms,
  grantExternalProgram,
  moderateFitnessProgram,
  requestProgramRefund,
  reviewFitnessProgram,
  reviewProgramImage,
} from "@/lib/programs.functions";
import type { Tables } from "@/integrations/supabase/types";
import { ProgramOutline } from "./ProgramOutline";
import { PrivateVideoPreview } from "./PrivateVideoPreview";
import { ProgramImagePreview } from "./ProgramImagePreview";
import { ProgramFinancialReport } from "./ProgramFinancialReport";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Program admin action failed";
export function ProgramAdmin() {
  const me = useUserId();
  const viewer = useRef(me);
  viewer.current = me;
  const [allowed, setAllowed] = useState(false),
    [error, setError] = useState(""),
    [editions, setEditions] = useState<Tables<"program_editions">[]>([]),
    [orders, setOrders] = useState<Tables<"program_orders">[]>([]),
    [terms, setTerms] = useState<Awaited<
      ReturnType<typeof getProgramCommercialTerms>
    > | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false);
  const [images, setImages] = useState<Tables<"program_images">[]>([]),
    [confirmedAt, setConfirmedAt] = useState("");
  const [member, setMember] = useState(""),
    [reference, setReference] = useState(""),
    [verified, setVerified] = useState(false),
    [bps, setBps] = useState("500"),
    [version, setVersion] = useState(""),
    [enabled, setEnabled] = useState(false),
    [approved, setApproved] = useState(false);
  const load = useCallback(async () => {
    try {
      if (!me) return;
      const auth = await supabase.auth.getUser();
      if (!auth.data.user || viewer.current !== me) return;
      const role = await supabase.rpc("has_role", {
        _user_id: auth.data.user.id,
        _role: "admin",
      });
      if (role.error || !role.data || viewer.current !== me) return;
      setAllowed(true);
      const [e, o, c, im] = await Promise.all([
        supabase
          .from("program_editions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("program_orders")
          .select("*")
          .not("paid_at", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        getProgramCommercialTerms(),
        supabase
          .from("program_images")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (viewer.current !== me) return;
      if (e.error || o.error || im.error)
        throw new Error(
          e.error?.message ?? o.error?.message ?? im.error?.message,
        );
      setEditions(e.data ?? []);
      setImages(im.data ?? []);
      setOrders(o.data ?? []);
      setTerms(c);
      setError("");
    } catch (e) {
      if (viewer.current === me) setError(message(e));
    }
  }, [me]);
  useEffect(() => {
    setAllowed(false);
    setEditions([]);
    setOrders([]);
    setImages([]);
    setTerms(null);
    setSelected(null);
    void load();
  }, [load]);
  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
      toast.success("Program action recorded");
      setVerified(false);
      await load();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  };
  if (!allowed) return null;
  const edition = editions.find((e) => e.id === selected);
  const parsed = edition ? programSchema.safeParse(edition.document) : null;
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-xl font-bold">Program review, access and payments</h2>
      {error && <p role="alert">{error}</p>}
      <button
        className="btn btn-outline"
        disabled={busy}
        onClick={() => void load()}
      >
        Refresh programs
      </button>
      <label className="block">
        Edition to review
        <select
          className="field"
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
        >
          <option value="">Choose an edition</option>
          {editions.map((e) => (
            <option key={e.id} value={e.id}>
              {String((e.document as Record<string, unknown>)["title"])} · v
              {e.version} · {e.review_status}
            </option>
          ))}
        </select>
      </label>
      {edition && parsed?.success && (
        <details className="rounded border p-4">
          <summary>Preview schedule and media</summary>
          <ProgramOutline document={parsed.data} />
          {[
            ...new Set(
              parsed.data.weeks.flatMap((w) =>
                w.days.flatMap((d) =>
                  d.workouts.flatMap((s) =>
                    [
                      ...(s.variations ?? []),
                      ...(s.exercises ?? []).flatMap((ex) => [
                        ex,
                        ...(ex.variations ?? []),
                      ]),
                    ].map((v) => v.image_id),
                  ),
                ),
              ),
            ),
          ]
            .filter((id): id is string => !!id)
            .map((id) => (
              <ProgramImagePreview key={id} id={id} />
            ))}
          {[
            ...new Set(
              parsed.data.weeks.flatMap((w) =>
                w.days.flatMap((d) =>
                  d.workouts.flatMap((s) => [
                    s.video_id,
                    ...(s.variations ?? []).map((v) => v.video_id),
                    ...(s.exercises ?? []).flatMap((ex) => [
                      ex.video_id,
                      ...(ex.variations ?? []).map((v) => v.video_id),
                    ]),
                  ]),
                ),
              ),
            ),
          ]
            .filter((id): id is string => !!id)
            .map((id) => (
              <PrivateVideoPreview key={id} id={id} />
            ))}
        </details>
      )}
      <label className="block">
        Review / moderation / refund reason
        <textarea
          className="field"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {edition && (
        <div className="flex flex-wrap gap-2">
          {(["approved", "rejected", "revoked"] as const).map((status) => (
            <button
              key={status}
              className="btn btn-outline"
              disabled={
                busy ||
                (status === "approved" && edition.review_status !== "pending")
              }
              onClick={() =>
                void act(() =>
                  reviewFitnessProgram({
                    data: { editionId: edition.id, status, note },
                  }),
                )
              }
            >
              {status === "approved"
                ? "Approve and publish"
                : status === "rejected"
                  ? "Reject edition"
                  : "Revoke edition access"}
            </button>
          ))}
          <button
            className="btn btn-ghost"
            disabled={busy || note.trim().length < 3}
            onClick={() =>
              void act(() =>
                moderateFitnessProgram({
                  data: { id: edition.program_id, blocked: true, note },
                }),
              )
            }
          >
            Block whole program
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy || note.trim().length < 3}
            onClick={() =>
              void act(() =>
                moderateFitnessProgram({
                  data: { id: edition.program_id, blocked: false, note },
                }),
              )
            }
          >
            Remove program block
          </button>
        </div>
      )}
      {edition && parsed?.success && parsed.data.mode === "external" && (
        <fieldset className="space-y-2 rounded border p-4" disabled={busy}>
          <legend>External receipt review</legend>
          <p className="text-sm">
            Independently verify the seller’s receipt and account identity
            before granting access. A click, screenshot alone, or self-reported
            payment is not automatic purchase verification. No external revenue
            is recorded or split by Tryumph.
          </p>
          <label className="block">
            Member account ID
            <input
              className="field"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            />
          </label>
          <label className="block">
            Verified receipt / case reference
            <input
              className="field"
              maxLength={500}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="block">
            Confirmed purchase time (from independently verified receipt)
            <input
              className="field"
              type="datetime-local"
              value={confirmedAt}
              onChange={(e) => setConfirmedAt(e.target.value)}
            />
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />
            I independently verified this receipt and identity
          </label>
          <button
            className="btn btn-outline"
            disabled={!verified || !confirmedAt}
            onClick={() =>
              void act(() =>
                grantExternalProgram({
                  data: {
                    editionId: edition.id,
                    memberId: member,
                    reference,
                    verified: true,
                    confirmedAt: new Date(confirmedAt).toISOString(),
                  },
                }),
              )
            }
          >
            Grant reviewed external access
          </button>
        </fieldset>
      )}
      <details>
        <summary className="font-bold">
          Private demonstration image review
        </summary>
        {images.map((i) => (
          <div key={i.id} className="my-3 space-y-2 rounded border p-3">
            <p>
              {i.object_path.split("/").at(-1)} · {i.review_status}
            </p>
            <ProgramImagePreview id={i.id} />
            <button
              className="btn btn-outline"
              disabled={busy || i.trainer_id === me}
              onClick={() =>
                void act(() =>
                  reviewProgramImage({
                    data: { id: i.id, status: "approved" },
                  }),
                )
              }
            >
              Approve image
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy || i.trainer_id === me}
              onClick={() =>
                void act(() =>
                  reviewProgramImage({
                    data: { id: i.id, status: "rejected" },
                  }),
                )
              }
            >
              Reject / withdraw image approval
            </button>
          </div>
        ))}
      </details>
      <ProgramFinancialReport />
      <details>
        <summary className="font-bold">
          Verified native purchases / refunds
        </summary>
        <p className="my-2 text-sm">
          Refund requests revoke access and hold payouts immediately. The
          provider worker must confirm actual refunds; a queued request is not a
          completed refund.
        </p>
        {orders.map((o) => (
          <div
            key={o.id}
            className="my-2 flex flex-wrap items-center justify-between gap-2 rounded border p-3"
          >
            <span className="text-sm">
              {o.id} · ${(o.price_cents / 100).toFixed(2)} · refunded $
              {(o.refunded_cents / 100).toFixed(2)} ·{" "}
              {o.refund_pending ? "refund requested" : o.status}
            </span>
            <button
              className="btn btn-outline"
              disabled={
                busy ||
                note.trim().length < 3 ||
                o.refund_pending ||
                o.status === "refunded"
              }
              onClick={() =>
                void act(() =>
                  requestProgramRefund({
                    data: { orderId: o.id, reason: note },
                  }),
                )
              }
            >
              Request full refund
            </button>
          </div>
        ))}
      </details>
      <details>
        <summary className="font-bold">Owner commercial approval</summary>
        <p className="mt-2 text-sm">
          Current commission:{" "}
          {terms?.commission_bps == null
            ? "Not decided"
            : `${terms.commission_bps / 100}% of revenue after actual processing fees`}
          . Terms: {terms?.terms_version ?? "Not approved"}. Database checkout:{" "}
          {terms?.enabled ? "enabled" : "disabled"}. Runtime gate:{" "}
          {terms?.runtimeEnabled ? "enabled" : "disabled"}.
        </p>
        {terms?.ownerCanApprove ? (
          <fieldset className="mt-3 space-y-3" disabled={busy}>
            <p className="text-sm">
              Enter the commercially approved rate, not an estimate. 100 basis
              points = 1%. This affects future orders only; prior purchase terms
              remain frozen.
            </p>
            <label className="block">
              Approved commission (basis points)
              <input
                className="field"
                type="number"
                min={0}
                max={10000}
                step={1}
                required
                value={bps}
                onChange={(e) => setBps(e.target.value)}
              />
            </label>
            <label className="block">
              Approved terms version / reference
              <input
                className="field"
                maxLength={120}
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Enable new native orders in database
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              I am the owner and approve these commercial terms
            </label>
            <button
              className="btn btn-outline"
              disabled={!approved || bps === ""}
              onClick={() =>
                void act(() =>
                  approveProgramTerms({
                    data: {
                      enabled,
                      commissionBps: Number(bps),
                      termsVersion: version,
                      approved: true,
                    },
                  }),
                )
              }
            >
              Record owner approval
            </button>
          </fieldset>
        ) : (
          <p className="mt-2 text-sm">
            Only the explicitly configured owner account can approve commercial
            terms. Native checkout stays disabled until that setup and approval
            are complete.
          </p>
        )}
      </details>
    </section>
  );
}
