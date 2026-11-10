import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EQUIPMENT } from "@/lib/data";
import {
  DEFAULT_PICK,
  pickCandidates,
  pickNext,
  pickReason,
  type PickPreferences,
  type PickWorkout,
} from "@/lib/pick-for-me";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { OnDemandPlayer } from "./OnDemandPlayer";
import { type CommunityTags } from "@/lib/workout-feedback";
import { CommunityTagBadges } from "./WorkoutFeedback";
export function PickForMe() {
  const [p, setP] = useState<PickPreferences>(DEFAULT_PICK),
    [picked, setPicked] = useState<PickWorkout | null>(null),
    [seen, setSeen] = useState<string[]>([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [community, setCommunity] = useState<CommunityTags>({});
  const generation = useRef(0);
  const change = (next: PickPreferences) => {
    generation.current++;
    setP(next);
    setPicked(null);
    setPlaying(false);
    setSeen([]);
    setStatus("");
  };
  const pick = async () => {
    const request = ++generation.current;
    setBusy(true);
    setPlaying(false);
    try {
      const gear = p.equipment.includes("Full gym")
        ? [...EQUIPMENT]
        : p.equipment;
      const r = await supabase.rpc("pick_workout_catalog", {
        p_minutes: p.minutes,
        p_equipment: gear,
        p_style: p.style,
        p_level: p.level,
        p_focus: p.focus,
        p_intensity: p.intensity,
        p_approximate: p.approximate,
      });
      if (r.error) throw new Error("Approved workout discovery is unavailable");
      if (request !== generation.current) return;
      const rows = (r.data as unknown as PickWorkout[]).slice(0, 250);
      const tags = await supabase.rpc("workout_community_tags", {
        p_ids: rows.map((x) => x.id),
      });
      if (request !== generation.current) return;
      const publicTags = (tags.error
        ? {}
        : tags.data) as unknown as CommunityTags;
      setCommunity(publicTags);
      const candidates = pickCandidates(
        rows.map((w) => ({
          ...w,
          communityTags: publicTags[w.id]?.tags ?? [],
        })),
        p,
      );
      const next = pickNext(candidates, seen);
      setPicked(next);
      setSeen((old) => (next ? [...old, next.id] : old));
      setStatus(
        next
          ? `${candidates.length} suitable workout${candidates.length === 1 ? "" : "s"} in the current approved catalog${candidates.length === 1 ? " · This is the only match" : ""}.`
          : "No suitable workout found. Try more time, another workout type or equipment you have. Safety and accessibility choices have been kept.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Discovery unavailable");
      setStatus("We could not load workouts. Please retry.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      id="pick-for-me"
      className="card my-6 space-y-4 border-primary/40 p-6"
    >
      <h2 className="text-2xl font-bold">Pick For Me</h2>
      <p>
        A free workout that fits your moment. Choose only what you want to
        share; these choices stay in this page and are not saved to your
        profile.
      </p>
      <details className="space-y-4">
        <summary className="cursor-pointer font-semibold">
          Choose time, equipment & preferences
        </summary>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            Available minutes
            <input
              className="field"
              type="number"
              min={1}
              max={180}
              list="pick-minutes"
              value={p.minutes}
              onChange={(e) =>
                change({ ...p, minutes: Number(e.target.value) })
              }
            />
            <datalist id="pick-minutes">
              {[5, 10, 15, 20, 30, 45, 60].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <label>
            Workout preference
            <select
              className="field"
              value={p.style}
              onChange={(e) => change({ ...p, style: e.target.value })}
            >
              <option value="any">Surprise me</option>
              {[
                "Strength",
                "Cardio",
                "Mobility",
                "Stretch",
                "Yoga",
                "Pilates",
                "Functional fitness",
                "HIIT",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Experience level
            <select
              className="field"
              value={p.level}
              onChange={(e) => change({ ...p, level: e.target.value })}
            >
              <option value="any">Any level</option>
              {["Beginner", "Intermediate", "Advanced"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Intensity
            <select
              className="field"
              value={p.intensity}
              onChange={(e) => change({ ...p, intensity: e.target.value })}
            >
              <option value="any">Surprise me</option>
              {["gentle", "moderate", "challenging"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="font-semibold">
            Equipment available · leave empty for none
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {[...EQUIPMENT.filter((x) => x !== "No equipment"), "Full gym"].map(
              (v) => (
                <label key={v} className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.equipment.includes(v)}
                    onChange={(e) =>
                      change({
                        ...p,
                        equipment: e.target.checked
                          ? [...p.equipment, v]
                          : p.equipment.filter((g) => g !== v),
                      })
                    }
                  />
                  {v === "Mat" ? "Yoga mat / exercise mat" : v}
                </label>
              ),
            )}
          </div>
        </fieldset>
        <DiscoveryFilters
          value={p.focus}
          onChange={(focus) => change({ ...p, focus })}
        />
        <fieldset>
          <legend className="font-semibold">
            Optional community impressions · ranking preferences
          </legend>
          <div className="flex flex-wrap gap-3">
            {[
              ["fun", "Fun"],
              ["beginner_friendly", "Beginner-friendly feeling"],
              ["relaxing", "Relaxing"],
              ["would_repeat", "Would do again"],
            ].map(([id, label]) => (
              <label key={id} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.community.includes(id!)}
                  onChange={(e) =>
                    change({
                      ...p,
                      community: e.target.checked
                        ? [...p.community, id!]
                        : p.community.filter((t) => t !== id),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Community impressions never determine medical or accessibility
            suitability.
          </p>
        </fieldset>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={p.approximate}
            onChange={(e) => change({ ...p, approximate: e.target.checked })}
          />
          Allow an approximate duration up to 5 minutes longer
        </label>
      </details>
      <button
        className="btn btn-primary"
        disabled={
          busy ||
          !Number.isFinite(p.minutes) ||
          p.minutes < 1 ||
          p.minutes > 180
        }
        onClick={() => void pick()}
      >
        {busy ? "Finding a workout…" : picked ? "Pick Again" : "Pick For Me"}
      </button>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {picked && (
        <article className="rounded-xl border p-4">
          <h3 className="text-xl font-bold">{picked.title}</h3>
          <p className="mt-2">{pickReason(picked, p)}</p>
          <p className="text-sm">
            Free · immediately playable · approved trainer content
          </p>
          <CommunityTagBadges value={community[picked.id]} />
          <button
            className="btn btn-outline mt-3"
            onClick={() => setPlaying(true)}
          >
            Play this workout
          </button>
        </article>
      )}
      {playing && picked && (
        <PickedPlayer
          key={picked.id}
          id={picked.id}
          onClose={() => setPlaying(false)}
        />
      )}
    </section>
  );
}
function PickedPlayer({ id, onClose }: { id: string; onClose: () => void }) {
  const [state, setState] = useState<{
    id: string;
    title: string;
    minutes: number;
    breaks: number[];
    break_seconds: number;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase
      .from("public_workout_catalog")
      .select("id,title,minutes,breaks,break_seconds")
      .eq("id", id)
      .single()
      .then((r) => {
        if (!active) return;
        if (
          r.error ||
          !r.data.id ||
          !r.data.title ||
          !r.data.minutes ||
          !r.data.breaks ||
          !r.data.break_seconds
        )
          setError(true);
        else setState(r.data as NonNullable<typeof state>);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return error ? (
    <p role="alert">Workout unavailable. Please pick again.</p>
  ) : state ? (
    <OnDemandPlayer video={state} onClose={onClose} />
  ) : (
    <p role="status">Opening approved workout…</p>
  );
}
