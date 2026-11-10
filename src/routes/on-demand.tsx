import { trackDiscoveryDemand } from "@/lib/demand";
import { PickForMe } from "@/components/PickForMe";
import { EverydayTryumphs } from "@/components/EverydayTryumphs";
import { CommunityTagBadges } from "@/components/WorkoutFeedback";
import type { CommunityTags } from "@/lib/workout-feedback";
import { DiscoveryFilters } from "@/components/DiscoveryFilters";
import { matchesDiscovery } from "@/lib/discovery";
import { OnDemandPlayer } from "@/components/OnDemandPlayer";
import { ProgramCatalog } from "@/components/ProgramCatalog";
import { goalScore } from "@/lib/fitness-goals";
import { isLaunchWorkout } from "@/lib/launch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { CATEGORIES, LEVELS, EQUIPMENT, DURATIONS, gearOf } from "@/lib/data";
import { useStore } from "@/lib/store";
import { thumbFor, workoutThumbFor } from "@/lib/thumbs";
import { PageHeader } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { ChoiceDropdown, MultiDropdown } from "@/components/WorkoutFilters";
import {
  matchesWorkout,
  isSafetyCompatible,
  SAFETY_OPTIONS,
  type WorkoutMatch,
  type WorkoutPreferences,
} from "@/lib/workout-preferences";

export const Route = createFileRoute("/on-demand")({
  validateSearch: z.object({ v: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "On-Demand Workouts — Tryumph Gym" },
      {
        name: "description",
        content:
          "Free approved workouts with advertising only during trainer-marked water breaks.",
      },
    ],
  }),
  component: OnDemand,
});

type Uploaded = {
  discovery_tags?: string[];
  intensity?: string;
  modification_notes?: string;
  description: string;
  spotify_url: string | null;
  id: string;
  user_id?: string;
  title: string;
  category: string;
  level: string;
  path: string;
  minutes: number;
  breaks: number[];
  equipment: string;
  pregnancy_safe: boolean;
  playlist: string;
  break_seconds: number;
  required_equipment?: string[];
  optional_equipment?: string[];
};
type Tab = "all" | "later" | "history" | "programs";
function OnDemand() {
  const { v } = Route.useSearch();
  const { s, toggleWatchLater, watch } = useStore();
  const [focus, setFocus] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string[]>([]),
    [lvl, setLvl] = useState("All levels");
  const [eq, setEq] = useState<string[]>([]),
    [needs, setNeeds] = useState<string[]>([]);
  const [dur, setDur] = useState("Any length"),
    [tab, setTab] = useState<Tab>("all");
  const [communityTags, setCommunityTags] = useState<CommunityTags>({});
  const [rows, setRows] = useState<Uploaded[]>([]),
    [open, setOpen] = useState<Uploaded | null>(null),
    [loading, setLoading] = useState(true);
  const preferences: WorkoutPreferences = s.signedIn
    ? {
        goals: s.extra.goals,
        level: s.profile.level,
        styles: s.extra.styles ?? [],
        gear: s.extra.gear ?? [],
        needs: s.extra.conditions,
        quiet: s.extra.quiet ?? false,
        pregnant: s.extra.pregnant ?? false,
        postpartum: s.profile.postpartum,
        equipmentChosen: true,
      }
    : {
        level: lvl,
        styles: cat,
        gear: eq,
        needs,
        quiet: false,
        equipmentChosen: eq.length > 0,
      };
  const load = useCallback(() => {
    setLoading(true);
    let query = supabase
      .from("public_workout_catalog")
      .select(
        "description,spotify_url,id,user_id,title,category,level,path,minutes,breaks,equipment,pregnancy_safe,playlist,break_seconds,required_equipment,optional_equipment,discovery_tags,intensity,modification_notes",
      )
      .eq("review_status", "approved")
      .order("created_at", { ascending: false })
      .limit(250);
    if (focus.length) query = query.contains("discovery_focus_tags", focus);
    void query.then(({ data, error }) => {
      setLoading(false);
      if (error) {
        toast.error("Cannot load approved workouts");
        setRows([]);
      } else setRows((data ?? []) as Uploaded[]);
    });
  }, [focus]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    let active = true;
    setCommunityTags({});
    if (rows.length)
      void supabase
        .rpc("workout_community_tags", { p_ids: rows.map((x) => x.id) })
        .then((r) => {
          if (active && !r.error)
            setCommunityTags(r.data as unknown as CommunityTags);
        });
    return () => {
      active = false;
    };
  }, [rows]);
  useEffect(() => {
    if (v) setOpen(rows.find((row) => row.id === v) ?? null);
  }, [v, rows]);
  const norm = (x: Uploaded): WorkoutMatch => ({
    ...x,
    pregnancySafe: x.pregnancy_safe,
    postpartum: x.level === "Postpartum",
  });
  const duration = DURATIONS.find((d) => d.label === dur);
  const preciseDuration = /^((?:Up to|Exactly)) (\d+) min$/.exec(dur);
  const matchesDuration = (minutes: number) =>
    preciseDuration
      ? preciseDuration[1] === "Exactly"
        ? minutes === Number(preciseDuration[2])
        : minutes <= Number(preciseDuration[2])
      : !duration || (minutes >= duration.min && minutes <= duration.max);
  const safe = rows.filter(
    (x) =>
      isLaunchWorkout(x) &&
      matchesDiscovery(x, focus) &&
      isSafetyCompatible(norm(x), preferences) &&
      matchesDuration(x.minutes) &&
      (!query.trim() || [x.title,x.category,x.level,x.description].join(" ").toLowerCase().includes(query.trim().toLowerCase())),
  );
  const visible =
    tab === "later"
      ? safe.filter((x) => s.watchLater.includes(x.id))
      : tab === "history"
        ? safe.filter((x) => s.history.includes(x.id))
        : safe;
  const best = visible.filter((x) => matchesWorkout(norm(x), preferences));
  const close = visible.filter(
    (x) =>
      !best.includes(x) &&
      (preferences.styles.includes(x.category) ||
        (preferences.goals?.length
          ? goalScore(norm(x), preferences.goals) > 0
          : false) ||
        (!preferences.styles.length &&
          !preferences.goals?.length &&
          (x.required_equipment ?? gearOf(x.equipment)).every(
            (g) => g === "No equipment" || preferences.gear.includes(g),
          ))),
  );
  const explore = visible.filter(
    (x) => !best.includes(x) && !close.includes(x),
  );
  const demandKey = JSON.stringify({ focus, cat, lvl, eq, dur, tab });
  useEffect(() => {
    if (loading || !s.signedIn || tab !== "all") return;
    const timer = setTimeout(() => {
      trackDiscoveryDemand({
        source: "workouts",
        tags: focus,
        categories: cat,
        equipment: eq,
        minutes: preciseDuration
          ? Number(preciseDuration[2])
          : (duration?.max ?? 0),
        minMinutes: preciseDuration ? 0 : (duration?.min ?? 0),
        exact: preciseDuration?.[1] === "Exactly",
        difficulty: lvl === "All levels" ? "" : lvl,
      });
    }, 600);
    return () => clearTimeout(timer); // explicit controls only; private profile preferences are excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandKey, loading, s.signedIn]);
  const openVideo = (x: Uploaded) => {
    watch(x.id);
    setOpen(x);
  };
  const save = (id: string) => {
    if (!s.signedIn) {
      toast.error("Sign in to save workouts");
      return;
    }
    toggleWatchLater(id);
  };
  const renderGroup = (
    title: string,
    description: string,
    group: Uploaded[],
  ) => (
    <section className="mb-7" key={title}>
      <h2 className="mb-1 text-xl font-bold">
        {title} ({group.length})
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      {group.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No workouts in this group yet.
        </p>
      ) : (
        <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {group.map((x) => (
            <article className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card" key={x.id}>
              <button
                onClick={() => openVideo(x)}
                className="relative grid aspect-video w-full place-items-center overflow-hidden bg-brand"
                aria-label={`Play ${x.title}`}
              >
                <img
                  src={workoutThumbFor(x.path, x.category)}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = thumbFor(x.category);
                  }}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/30">
                  <Play className="h-9 w-9 text-white drop-shadow" />
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs font-semibold text-white">{x.minutes} min</span>
              </button>
              <div className="space-y-2 p-4">
                <p className="text-xs font-medium text-primary">{x.category} · {x.level}{x.pregnancy_safe ? " · Prenatal focus" : ""}</p>
                <button type="button" className="block text-left text-base font-semibold leading-snug hover:text-primary" onClick={() => openVideo(x)}>{x.title}</button>
                <p className="line-clamp-2 text-sm text-muted-foreground">{x.description}</p>
                <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>{(x.required_equipment ?? gearOf(x.equipment)).join(", ") || "No equipment"}</span>
                  <span>· {x.breaks?.length ? `${x.breaks.length} water breaks` : "Ad-free"}</span>
                </div>
                <CommunityTagBadges value={communityTags[x.id]} />
                <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                  <button type="button" className="text-sm font-semibold text-primary" onClick={() => openVideo(x)}>Watch workout →</button>
                  <button type="button" onClick={() => save(x.id)} aria-label={s.watchLater.includes(x.id) ? "Remove saved workout" : "Save workout"} className="text-primary">
                    {s.watchLater.includes(x.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                  </button>
                </div>
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Workout details & music</summary>
                  <p className="mt-2">Intensity: {x.intensity || "Not specified"}</p>
                  {x.modification_notes && <p className="mt-1 whitespace-pre-wrap">{x.modification_notes}</p>}
                  {x.spotify_url?.startsWith("https://open.spotify.com/playlist/") && <a className="mt-2 inline-block text-primary underline" href={x.spotify_url} target="_blank" rel="noopener noreferrer">Spotify playlist</a>}
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
  return (
    <div>
      <PageHeader
        eyebrow="Watch anytime · Free workouts"
        title="Find your next workout"
        sub="Discover trainer-led workouts that fit your time, equipment and goals. Ads appear only during water breaks, never mid-set."
      />
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label htmlFor="workout-search" className="sr-only">Search workouts</label>
        <input
          id="workout-search"
          type="search"
          className="field min-w-0 flex-1"
          placeholder="Search workouts, styles and levels…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">Only approved trainer workouts are shown</span>
      </div>
      <DiscoveryFilters value={focus} onChange={setFocus} />
      <PickForMe />
      <EverydayTryumphs />

      {open && (
        <OnDemandPlayer
          key={open.id}
          video={open}
          onClose={() => setOpen(null)}
        />
      )}
      <nav className="mb-5 flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Browse workout library">
        {(["all", "programs", "later", "history"] as Tab[])
          .filter((t) => s.signedIn || t === "all" || t === "programs")
          .map((t) => (
            <Button
              key={t}
              variant={tab === t ? "secondary" : "ghost"}
              onClick={() => setTab(t)}
            >
              {t === "all"
                ? "Library"
                : t === "programs"
                  ? "Programs"
                  : t === "later"
                    ? `Watch later (${s.watchLater.length})`
                    : "History"}
            </Button>
          ))}
      </nav>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!s.signedIn && (
          <>
            <ChoiceDropdown
              label="Level"
              value={lvl}
              options={["All levels", ...LEVELS]}
              onChange={setLvl}
            />
            <MultiDropdown
              label="Style"
              values={cat}
              options={CATEGORIES}
              emptyLabel="All styles"
              onChange={setCat}
            />
            <MultiDropdown
              label="Gear"
              values={eq}
              options={EQUIPMENT}
              emptyLabel="Any equipment"
              exclusive="No equipment"
              onChange={setEq}
            />
            <MultiDropdown
              label="Safety"
              values={needs}
              options={SAFETY_OPTIONS}
              emptyLabel="No preferences"
              onChange={setNeeds}
            />
          </>
        )}
        <ChoiceDropdown
          label="Time"
          value={dur}
          options={[
            "Any length",
            ...DURATIONS.map((d) => d.label),
            ...[5, 10, 15, 20, 30, 45, 60, 90].flatMap((min) => [
              `Up to ${min} min`,
              `Exactly ${min} min`,
            ]),
          ]}
          onChange={setDur}
        />
        {s.signedIn && (
          <Link className="btn btn-ghost" to="/account">
            Edit workout preferences
          </Link>
        )}
      </div>
      {loading ? (
        <p className="card p-6">Loading approved workouts…</p>
      ) : tab === "programs" ? (
        <>
          <ProgramCatalog />
          <PublicPrograms onPlay={openVideo} workouts={safe} />
        </>
      ) : (
        <>
          {renderGroup(
            "Best Matches",
            "Meets your workout and safety preferences.",
            best,
          )}
          {renderGroup(
            "Close Matches",
            "Review level and equipment before starting.",
            close,
          )}
          {renderGroup(
            "Explore All",
            "Additional approved workouts that pass your safety preferences.",
            explore,
          )}
        </>
      )}
    </div>
  );
}

function PublicPrograms({
  onPlay,
  workouts,
}: {
  onPlay: (video: Uploaded) => void;
  workouts: Uploaded[];
}) {
  const [programs, setPrograms] = useState<
    { id: string; title: string; description: string }[]
  >([]);
  const [ordered, setOrdered] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("trainer_programs")
        .select("id,title,description")
        .eq("published", true)
        .eq("builder_version", 1);
      if (error || !active) return;
      setPrograms(data ?? []);
      const { data: items } = await supabase
        .from("trainer_program_workouts")
        .select("program_id,video_id,position")
        .in(
          "program_id",
          (data ?? []).map((x) => x.id),
        )
        .order("position");
      if (!active) return;
      const map: Record<string, string[]> = {};
      for (const row of items ?? [])
        (map[row.program_id] ??= []).push(row.video_id);
      setOrdered(map);
    })();
    return () => {
      active = false;
    };
  }, []);
  if (!programs.length)
    return (
      <p className="card p-6 text-muted-foreground">
        Legacy public playlists will appear here.
      </p>
    );
  return (
    <div className="space-y-4">
      {programs.map((p) => (
        <section key={p.id} className="card p-5">
          <h2 className="text-xl font-bold">{p.title}</h2>
          <p className="text-sm text-muted-foreground">{p.description}</p>
          <ol className="mt-3 space-y-2">
            {(ordered[p.id] ?? []).map((id, i) => {
              const video = workouts.find((v) => v.id === id);
              return video ? (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 border-t pt-2"
                >
                  <span>
                    {i + 1}. {video.title} · {video.minutes} min
                  </span>
                  <button
                    className="btn btn-outline"
                    onClick={() => onPlay(video)}
                  >
                    Play
                  </button>
                </li>
              ) : null;
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
