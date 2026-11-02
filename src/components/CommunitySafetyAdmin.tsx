import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCommunityPhotoAdmin } from "@/lib/community-media.functions";
import { AuthorizedPhoto } from "./CommunityPostPhotos";
import type { Tables } from "@/integrations/supabase/types";
export function CommunitySafetyAdmin() {
  const [photos, setPhotos] = useState<
      Awaited<ReturnType<typeof getCommunityPhotoAdmin>>
    >([]),
    [feedback, setFeedback] = useState<Tables<"workout_feedback">[]>([]),
    [reports, setReports] = useState<Tables<"community_ad_reports">[]>([]),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<string | null>(null),
    [minimum, setMinimum] = useState(10),
    [agreement, setAgreement] = useState(70);
  const load = useCallback(async () => {
    try {
      const [p, f, a, c] = await Promise.all([
        getCommunityPhotoAdmin(),
        supabase
          .from("workout_feedback")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("community_ad_reports")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("workout_feedback_config")
          .select("min_members,agreement_bps")
          .eq("singleton", true)
          .single(),
      ]);
      if (f.error || a.error || c.error)
        throw new Error("Safety report unavailable");
      setPhotos(p);
      setFeedback(f.data);
      setReports(a.data);
      setMinimum(c.data.min_members);
      setAgreement(c.data.agreement_bps / 100);
      setError("");
    } catch {
      setError(
        "Community review unavailable. Administrator access and staging migrations are required.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (run: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    try {
      const r = await run();
      if (r.error) throw r.error;
      await load();
      toast.success("Review action recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review action failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-xl font-bold">
        Community photos, feedback and advertisements
      </h2>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-outline" onClick={() => void load()}>
        Refresh community safety
      </button>
      <label>
        Review reason
        <textarea
          className="field"
          value={reason}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <h3 className="font-bold">
        Photo review · latest 100 active attachments
      </h3>
      <p className="text-sm">
        Specialist holds and unassessed uploads cannot be previewed here. Use
        the provider’s approved specialist reporting and retention procedure; do
        not download, copy or forward held originals. Fitness, pregnancy,
        postpartum, breastfeeding and recovery images require contextual review,
        not automatic rejection based on skin exposure. Members may appeal
        through support.
      </p>
      {photos.map((p) => (
        <div className="border-t py-3" key={p.id}>
          <p>
            Photo {p.id} · Post {p.post_id} · {p.status}
          </p>
          {p.specialist_cleared &&
            ["review", "approved"].includes(p.status) && (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => setPreview(preview === p.id ? null : p.id)}
                >
                  Open cleared review preview
                </button>
                {preview === p.id && <AuthorizedPhoto id={p.id} review />}
                {[true, false].map((approve) => (
                  <button
                    className="btn btn-outline mr-2"
                    key={String(approve)}
                    disabled={busy || reason.trim().length < 3}
                    onClick={() =>
                      void act(() =>
                        supabase.rpc("admin_review_post_photo", {
                          p_photo: p.id,
                          p_approve: approve,
                          p_reason: reason,
                        }),
                      )
                    }
                  >
                    {approve
                      ? "Approve reviewed photo"
                      : "Reject / revoke photo"}
                  </button>
                ))}
              </>
            )}
        </div>
      ))}
      <h3 className="font-bold">Community Tag thresholds</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Minimum unique members
          <input
            className="field"
            type="number"
            min={10}
            max={100000}
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          />
        </label>
        <label>
          Agreement percentage
          <input
            className="field"
            type="number"
            min={70}
            max={100}
            step={0.01}
            value={agreement}
            onChange={(e) => setAgreement(Number(e.target.value))}
          />
        </label>
      </div>
      <button
        className="btn btn-outline"
        disabled={busy || minimum < 10 || agreement < 70 || agreement > 100}
        onClick={() =>
          void act(() =>
            supabase.rpc("configure_workout_feedback", {
              p_min: minimum,
              p_bps: Math.round(agreement * 100),
            }),
          )
        }
      >
        Save audited thresholds
      </button>
      <h3 className="font-bold">
        Private feedback investigation · latest 100 submissions
      </h3>
      {feedback.map((f) => (
        <div
          className="border-t py-2 text-sm"
          key={`${f.video_id}:${f.user_id}`}
        >
          <p>
            Workout {f.video_id} · Member {f.user_id} · {f.tags.join(", ")} ·{" "}
            {f.excluded ? "Excluded from public aggregates" : "Included"}
          </p>
          <button
            className="btn btn-outline"
            disabled={busy || reason.trim().length < 3}
            onClick={() =>
              void act(() =>
                supabase.rpc("moderate_workout_feedback", {
                  p_video: f.video_id,
                  p_user: f.user_id,
                  p_excluded: !f.excluded,
                  p_reason: reason,
                }),
              )
            }
          >
            {f.excluded
              ? "Restore reviewed submission"
              : "Exclude suspicious submission"}
          </button>
        </div>
      ))}
      <h3 className="font-bold">Advertisement reports · latest 100</h3>
      {reports.length === 0 && (
        <p className="text-sm">No advertisement reports in this window.</p>
      )}
      {reports.map((r) => (
        <div className="border-t py-2 text-sm" key={r.id}>
          <p>
            Creative {r.creative_id} · {r.reason}
          </p>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Feed advertising is disabled until reviewed provider or sponsorship
        setup. Revenue belongs entirely to Tryumph and never enters trainer
        video-ad earnings. Rejected-upload retention and specialist legal
        handling require approved operational policies before photo activation.
      </p>
    </section>
  );
}
