import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import {
  FEEDBACK_TAGS,
  type CommunityTagSummary,
} from "@/lib/workout-feedback";
export function CommunityTagBadges({
  value,
}: {
  value?: CommunityTagSummary | undefined;
}) {
  return value?.tags.length ? (
    <aside className="my-2 text-xs" aria-label="Community Tags">
      <strong>Community Tags</strong>
      <p>
        {value.tags
          .map((id) => FEEDBACK_TAGS.find(([key]) => key === id)?.[1])
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-muted-foreground">
        Optional impressions from {value.respondents} members; not a
        representative survey or medical / accessibility assessment.
      </p>
    </aside>
  ) : null;
}
export function WorkoutFeedback({
  videoId,
  eligible,
}: {
  videoId: string;
  eligible: boolean;
}) {
  const me = useUserId(),
    [tags, setTags] = useState<string[]>([]),
    [saved, setSaved] = useState(false),
    [skip, setSkip] = useState(false),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [summary, setSummary] = useState<CommunityTagSummary>();
  useEffect(() => {
    let active = true;
    setTags([]);
    setSaved(false);
    setSkip(false);
    setStatus("");
    setSummary(undefined);
    void supabase
      .rpc("workout_community_tags", { p_ids: [videoId] })
      .then((r) => {
        if (active && !r.error)
          setSummary(
            (r.data as unknown as Record<string, CommunityTagSummary>)[videoId],
          );
      });
    if (me)
      void supabase
        .from("workout_feedback")
        .select("tags")
        .eq("video_id", videoId)
        .eq("user_id", me)
        .maybeSingle()
        .then((r) => {
          if (active && !r.error && r.data) {
            setTags(r.data.tags);
            setSaved(true);
          }
        });
    return () => {
      active = false;
    };
  }, [me, videoId]);
  const save = async (remove = false) => {
    setBusy(true);
    const r = remove
      ? await supabase.rpc("remove_workout_feedback", { p_video: videoId })
      : await supabase.rpc("save_workout_feedback", {
          p_video: videoId,
          p_tags: tags,
        });
    setBusy(false);
    if (r.error) setStatus(r.error.message);
    else {
      setSaved(!remove);
      if (remove) setTags([]);
      setStatus(
        remove
          ? "Your feedback was removed."
          : "Thank you. You can update or remove your feedback at any time.",
      );
    }
  };
  return (
    <section className="p-4">
      <CommunityTagBadges value={summary} />
      {me && (eligible || saved) && !skip && (
        <fieldset disabled={busy} className="space-y-3">
          <legend className="font-semibold">How was that workout?</legend>
          <p className="text-xs">
            Optional and private. These impressions never establish pregnancy,
            postpartum or clinical suitability. You can skip this without
            changing access or progress.
          </p>
          <div className="flex flex-wrap gap-3">
            {FEEDBACK_TAGS.map(([id, label]) => (
              <label key={id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tags.includes(id)}
                  onChange={(e) =>
                    setTags(
                      e.target.checked
                        ? [...tags, id]
                        : tags.filter((t) => t !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline"
              disabled={!tags.length}
              onClick={() => void save()}
            >
              {saved ? "Update feedback" : "Save feedback"}
            </button>
            {saved && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void save(true)}
              >
                Remove my feedback
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSkip(true)}
            >
              Skip
            </button>
          </div>
        </fieldset>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
