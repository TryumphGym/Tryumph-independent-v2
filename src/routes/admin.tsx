import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LAUNCH } from "@/lib/launch";
import { useUserId } from "@/lib/community";
import { PageHeader } from "@/components/Avatar";
import { payOutPending } from "@/lib/payouts.functions";
import { PrivateVideoPreview } from "@/components/PrivateVideoPreview";
import { AdminOperations } from "@/components/AdminOperations";
import { AdminSafetyCenter } from "@/components/AdminSafetyCenter";
import { AdminSponsorCampaigns } from "@/components/AdminSponsorCampaigns";
import {
  interestLabel,
  referralLabel,
  waitlistCsv,
  type WaitlistEntry,
} from "@/lib/waitlist";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Certification Review — Tryumph Gym Admin" },
      {
        name: "description",
        content: "Review and verify trainer certifications on Tryumph Gym.",
      },
      {
        property: "og:title",
        content: "Certification Review — Tryumph Gym Admin",
      },
      {
        property: "og:description",
        content: "Admin queue for verifying trainer credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Row = {
  id: string;
  trainer_name: string;
  name: string;
  credential_id: string;
  expires: string;
  status: string;
  created_at: string;
  note: string;
  document_path: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

const REGISTRIES: [string, string][] = [
  ["USREPS", "https://www.usreps.org/"],
  ["NASM", "https://www.nasm.org/verify-credential"],
  ["ACE", "https://www.acefitness.org/resources/everyone/find-ace-pro/"],
  ["ISSA", "https://www.issaonline.com/verify"],
  ["CDR (dietitian)", "https://www.cdrnet.org/LicensureMap"],
];

function Admin() {
  const me = useUserId();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [reviewVideos, setReviewVideos] = useState<
    {
      id: string;
      user_id: string;
      title: string;
      path: string;
      review_status: string;
      created_at: string;
    }[]
  >([]);
  const [wl, setWl] = useState<WaitlistEntry[]>([]);
  const [youth, setYouth] = useState<
    {
      id: string;
      contributor_name: string;
      contributor_age: number;
      guardian_name: string;
      guardian_email: string;
      guardian_signature: string;
      status: string;
      created_at: string;
    }[]
  >([]);
  const load = useCallback(async () => {
    const videoResult = await supabase
      .from("trainer_videos")
      .select("id,user_id,title,path,review_status,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setReviewVideos((videoResult.data ?? []) as typeof reviewVideos);
    const y = await supabase
      .from("youth_consents")
      .select("*")
      .order("created_at", { ascending: false });
    setYouth(y.data ?? []);
    const { data } = await supabase
      .from("certifications")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    const w = await supabase
      .from("waitlist_entries")
      .select(
        "email,role,created_at,heard_from,live_class_interest,notify_new_coaches",
      )
      .order("created_at", { ascending: false });
    setWl(w.data ?? []);
  }, []);
  const reviewVideo = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.rpc("review_trainer_video", {
      p_video_id: id,
      p_status: status,
      p_note: notes[id] ?? "",
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Video ${status}`);
      void load();
    }
  };
  const exportWl = () => {
    const csv = waitlistCsv(wl);
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    a.href = url;
    a.download = "tryumph-waitlist.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  useEffect(() => {
    if (!me) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: me, _role: "admin" })
      .then(({ data }) => {
        setIsAdmin(!!data);
        if (data) load();
      });
  }, [me, load]);
  const openDocument = async (path: string) => {
    if (!path || !path.includes("/")) {
      toast.error("No document attached");
      return;
    }
    const { data, error } = await supabase.storage
      .from("trainer-certificates")
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not access private document");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const decide = async (id: string, status: "verified" | "rejected") => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error("Sign in to review certifications");
      return;
    }
    const { error } = await supabase
      .from("certifications")
      .update({
        status,
        verified_at: status === "verified" ? new Date().toISOString() : null,
        verified_by: status === "verified" ? auth.user.id : null,
        note: notes[id] ?? "",
      })
      .eq("id", id);
    if (error) toast.error("Couldn't update");
    else {
      toast.success(status === "verified" ? "Verified" : "Rejected");
      load();
    }
  };
  const decideYouth = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("youth_consents")
      .update({ status })
      .eq("id", id);
    if (error) toast.error("Couldn't update");
    else {
      toast.success(
        status === "approved" ? "Youth Ambassador approved" : "Rejected",
      );
      load();
    }
  };
  if (isAdmin === null)
    return <p className="text-muted-foreground">Loading…</p>;
  if (!isAdmin)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="mt-2 text-muted-foreground">
          This page is for the Tryumph team.
        </p>
      </div>
    );
  const pending = rows.filter((r) => r.status === "pending");
  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold">Waitlist: {wl.length}</h2>
            <p className="text-sm text-muted-foreground">
              {wl.filter((r) => r.role === "parent").length} parents ·{" "}
              {wl.filter((r) => r.role === "coach").length} coaches
            </p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={exportWl}
            disabled={!wl.length}
          >
            Download list
          </button>
        </div>
        {wl.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sign-ups yet. They'll appear here as soon as someone joins from
            the home page.
          </p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {wl.map((r) => (
              <div
                key={r.email}
                className="flex flex-wrap items-center gap-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 break-all font-medium">
                  {r.email}
                </span>
                <span className="chip">
                  {r.role === "coach" ? "Coach" : "Parent"}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                <div className="w-full text-xs text-muted-foreground">
                  Heard from: {referralLabel(r.heard_from)} · $5 live class:{" "}
                  {interestLabel(r.live_class_interest)} · New-coach emails:{" "}
                  {r.notify_new_coaches ? "Yes" : "No"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1">
          <h2 className="text-xl font-bold">Trainer payouts</h2>
          <p className="text-sm text-muted-foreground">
            Pays eligible pending trainer earnings after processing fees and
            reconciles refunds.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              const r = await payOutPending();
              toast.success(
                `Transferred ${r.paid} earning(s), reversed ${r.reversed} refund(s), ${r.waiting} still waiting.`,
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Payout failed");
            }
          }}
        >
          Pay out now
        </button>
      </section>
      <AdminSponsorCampaigns />
      <AdminOperations />
      <AdminSafetyCenter />
      {LAUNCH.youth && (
        <section className="card space-y-3 p-5">
          <div>
            <h2 className="text-xl font-bold">Youth contributor approvals</h2>
            <p className="text-sm text-muted-foreground">
              {youth.filter((y) => y.status === "pending").length} waiting.
              Confirm the guardian by email before approving.
            </p>
          </div>
          {youth.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No youth applications yet.
            </p>
          ) : (
            youth.map((y) => (
              <div
                key={y.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary p-3 text-sm"
              >
                <div className="flex-1">
                  <p className="font-semibold">
                    {y.contributor_name}, age {y.contributor_age}
                  </p>
                  <p className="text-muted-foreground">
                    Guardian: {y.guardian_name} ·{" "}
                    <a
                      className="text-primary underline"
                      href={`mailto:${y.guardian_email}`}
                    >
                      {y.guardian_email}
                    </a>{" "}
                    · signed "{y.guardian_signature}" ·{" "}
                    {new Date(y.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="chip">{y.status}</span>
                {y.status === "pending" && (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => decideYouth(y.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => decideYouth(y.id, "rejected")}
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </section>
      )}
      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-bold">Video approval queue</h2>
        <p className="text-sm text-muted-foreground">
          Review the video in Bunny's private dashboard before approving. Do not
          approve until trainer credentials are verified. Public playback is
          blocked until approved.
        </p>
        {reviewVideos
          .filter((v) => v.review_status === "pending")
          .map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-3 border-b border-border py-3 text-sm"
            >
              <div className="flex-1">
                <p className="font-semibold">{v.title}</p>
                <p className="text-xs text-muted-foreground">
                  Trainer {v.user_id} · {v.path}
                </p>
              </div>
              <PrivateVideoPreview id={v.id} />
              <textarea
                className="field"
                placeholder="Review notes"
                value={notes[v.id] ?? ""}
                onChange={(e) =>
                  setNotes((old) => ({ ...old, [v.id]: e.target.value }))
                }
              />
              <button
                className="btn btn-primary"
                onClick={() => void reviewVideo(v.id, "approved")}
              >
                Approve
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void reviewVideo(v.id, "rejected")}
              >
                Reject
              </button>
            </div>
          ))}
        {!reviewVideos.some((v) => v.review_status === "pending") && (
          <p className="text-sm text-muted-foreground">No pending videos.</p>
        )}
      </section>
      <PageHeader
        eyebrow="Admin"
        title="Certification review"
        sub={`${pending.length} waiting for review`}
      />
      <div className="space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="card flex flex-wrap items-center gap-4 p-4"
          >
            <div className="flex-1">
              <p className="font-semibold">
                {r.trainer_name || "Trainer"} — {r.name}
              </p>
              <p className="text-sm text-muted-foreground">
                ID {r.credential_id || "—"} · expires {r.expires || "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="text-muted-foreground">Check registry:</span>
                {REGISTRIES.map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="chip hover:text-primary"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
            <textarea
              className="field"
              placeholder="Credential review notes"
              value={notes[r.id] ?? ""}
              onChange={(e) =>
                setNotes((old) => ({ ...old, [r.id]: e.target.value }))
              }
            />
            {(r.document_path || (r.note.includes("/") ? r.note : "")) && (
              <button
                className="btn btn-ghost"
                onClick={() => void openDocument(r.document_path || r.note)}
              >
                View document
              </button>
            )}
            <span className="chip">{r.status}</span>
            {r.status === "pending" && (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => decide(r.id, "verified")}
                >
                  Verify
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => decide(r.id, "rejected")}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-muted-foreground">
            No certifications submitted yet.
          </p>
        )}
      </div>
    </div>
  );
}
