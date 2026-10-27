import { nextWaterBreak } from "@/lib/adBreaks";
import { goalScore } from "@/lib/fitness-goals";
import { isLaunchWorkout } from "@/lib/launch";
import { WaterBreakSponsor } from "@/components/WaterBreakSponsor";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, BookmarkCheck, Droplets, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { CATEGORIES, LEVELS, EQUIPMENT, DURATIONS, gearOf } from "@/lib/data";
import { useStore } from "@/lib/store";
import { getVideoUrl } from "@/lib/videos.functions";
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
  const [cat, setCat] = useState<string[]>([]),
    [lvl, setLvl] = useState("All levels");
  const [eq, setEq] = useState<string[]>([]),
    [needs, setNeeds] = useState<string[]>([]);
  const [dur, setDur] = useState("Any length"),
    [tab, setTab] = useState<Tab>("all");
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
  const load = () => {
    setLoading(true);
    void supabase
      .from("trainer_videos")
      .select(
        "description,spotify_url,id,user_id,title,category,level,path,minutes,breaks,equipment,pregnancy_safe,playlist,break_seconds,required_equipment,optional_equipment",
      )
      .eq("review_status", "approved")
      .order("created_at", { ascending: false })
      .limit(250)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast.error("Cannot load approved workouts");
          setRows([]);
        } else setRows((data ?? []) as Uploaded[]);
      });
  };
  useEffect(() => {
    load();
  }, []);
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
      isSafetyCompatible(norm(x), preferences) &&
      matchesDuration(x.minutes),
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {group.map((x) => (
            <article className="card overflow-hidden" key={x.id}>
              <button
                onClick={() => openVideo(x)}
                className="bg-brand grid aspect-video w-full place-items-center"
                aria-label={`Play ${x.title}`}
              >
                <Play className="h-8 w-8 text-primary-foreground" />
              </button>
              <div className="p-4">
                <p className="eyebrow">
                  {x.category} · {x.level}
                  {x.pregnancy_safe ? " · Pregnancy safe" : ""}
                </p>
                <p className="font-semibold">{x.title}</p>
                <p className="text-sm text-muted-foreground">{x.description}</p>
                {x.spotify_url?.startsWith(
                  "https://open.spotify.com/playlist/",
                ) && (
                  <a
                    className="text-sm text-primary underline"
                    href={x.spotify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Spotify playlist
                  </a>
                )}
                <p className="text-sm text-muted-foreground">
                  {x.minutes} minutes ·{" "}
                  {(x.required_equipment ?? gearOf(x.equipment)).join(", ") ||
                    "No equipment"}{" "}
                  ·{" "}
                  {(x.breaks ?? []).length
                    ? `${x.breaks.length} water breaks`
                    : "Ad-free"}
                </p>
                <div className="mt-2 flex justify-between gap-3">
                  <button
                    className="text-primary underline"
                    onClick={() => openVideo(x)}
                  >
                    Watch
                  </button>
                  <button
                    onClick={() => save(x.id)}
                    aria-label="Save workout"
                    className="text-primary"
                  >
                    {s.watchLater.includes(x.id) ? (
                      <BookmarkCheck className="h-5 w-5" />
                    ) : (
                      <Bookmark className="h-5 w-5" />
                    )}
                  </button>
                </div>
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
        eyebrow="Free · Approved trainer videos"
        title="On-Demand Library"
        sub="Sponsored messages are shown only during water breaks, never during a set."
      />
      {open && (
        <RealPlayer key={open.id} video={open} onClose={() => setOpen(null)} />
      )}
      <div className="mb-4 flex flex-wrap gap-2">
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
      </div>
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
        <PublicPrograms onPlay={openVideo} workouts={safe} />
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
        .eq("published", true);
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
        Published trainer programs will appear here.
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

function RealPlayer({
  video,
  onClose,
}: {
  video: Uploaded;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [ad, setAd] = useState(0);
  const [activeBreak, setActiveBreak] = useState<number | null>(null);
  const [soon, setSoon] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [playbackId] = useState(() => {
    const key = `tryumph-playback:${video.id}`;
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  });
  const ref = useRef<HTMLVideoElement>(null);
  const previous = useRef(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const sign = useServerFn(getVideoUrl);
  const bunny =
    !!url && /https:\/\/(?:iframe|player)\.mediadelivery\.net\//.test(url);
  const command = (method: string) =>
    frameRef.current?.contentWindow?.postMessage(
      {
        context: "player.js",
        version: "0.0.11",
        method,
      },
      new URL(url ?? "https://player.mediadelivery.net").origin,
    );
  const resume = () => {
    setAd(0);
    setActiveBreak(null);
    if (bunny) command("play");
    else void ref.current?.play().catch(() => {});
  };
  const progress = (seconds: number) => {
    if (ad > 0 || !Number.isFinite(seconds)) return;
    const last = previous.current;
    previous.current = seconds;
    if (seconds - last > 3) {
      setDone(
        (old) =>
          new Set([
            ...old,
            ...(video.breaks ?? []).filter((b) => b <= seconds + 2),
          ]),
      );
      return;
    }
    const hit = nextWaterBreak(
      video.breaks ?? [],
      done,
      last,
      seconds,
      video.minutes,
    );
    if (hit !== null) {
      if (bunny) command("pause");
      else ref.current?.pause();
      setDone((old) => new Set([...old, hit]));
      setActiveBreak(hit);
      setAd([15, 30].includes(video.break_seconds) ? video.break_seconds : 15);
      setSoon(false);
      return;
    }
    setSoon(
      (video.breaks ?? []).some(
        (b) => !done.has(b) && b - seconds > 0 && b - seconds <= 5,
      ),
    );
  };
  useEffect(() => {
    setDone(new Set());
    setAd(0);
    setActiveBreak(null);
    setUrl(null);
    sign({ data: { id: video.id } })
      .then(setUrl)
      .catch(() => {
        setUrl(null);
        toast.error("Unable to open this workout. Please try again.");
      });
  }, [video.id]);
  useEffect(() => {
    if (!bunny) return;
    const frame = frameRef.current;
    const origin = new URL(url!).origin;
    const receive = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame?.contentWindow)
        return;
      const msg =
        typeof event.data === "string"
          ? (() => {
              try {
                return JSON.parse(event.data);
              } catch {
                return null;
              }
            })()
          : event.data;
      if (msg?.context !== "player.js") return;
      if (msg.event === "ready")
        frame?.contentWindow?.postMessage(
          {
            context: "player.js",
            version: "0.0.11",
            method: "addEventListener",
            value: "timeupdate",
          },
          origin,
        );
      if (msg.event === "timeupdate" && typeof msg.value?.seconds === "number")
        progress(msg.value.seconds);
    };
    window.addEventListener("message", receive);
    // The player.js protocol works on both the modern and legacy Bunny players.
    const register = () => {
      frame?.contentWindow?.postMessage(
        {
          context: "player.js",
          version: "0.0.11",
          method: "addEventListener",
          value: "timeupdate",
        },
        origin,
      );
    };
    frame?.addEventListener("load", register);
    register();
    return () => {
      window.removeEventListener("message", receive);
      frame?.removeEventListener("load", register);
    };
  }, [url, bunny, ad, done]);
  useEffect(() => {
    if (ad <= 0) return;
    const timeout = setTimeout(
      () =>
        setAd((a) => {
          if (a === 1) {
            if (bunny) command("play");
            else void ref.current?.play().catch(() => {});
            setActiveBreak(null);
          }
          return Math.max(0, a - 1);
        }),
      1000,
    );
    return () => clearTimeout(timeout);
  }, [ad, bunny, url]);
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="relative bg-secondary">
        {bunny ? (
          <iframe
            ref={frameRef}
            src={url!}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="aspect-video w-full"
          />
        ) : url ? (
          <video
            ref={ref}
            src={url}
            controls={ad === 0}
            autoPlay
            onTimeUpdate={(e) => progress(e.currentTarget.currentTime)}
            className="aspect-video w-full"
          />
        ) : (
          <div className="grid aspect-video place-items-center text-muted-foreground">
            Loading…
          </div>
        )}
        {ad > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-background/95 text-center">
            <div>
              <Droplets className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-2xl font-bold">
                Water break 💧
              </p>
              <p className="text-muted-foreground">
                Grab some water — resuming in {ad}s
              </p>
              {activeBreak !== null && (
                <WaterBreakSponsor
                  videoId={video.id}
                  second={activeBreak}
                  playbackId={playbackId}
                />
              )}
              <button className="btn btn-ghost mt-3" onClick={resume}>
                Resume now
              </button>
            </div>
          </div>
        )}
        {soon && ad === 0 && (
          <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
            💧 Water break soon
          </div>
        )}
        <button
          onClick={onClose}
          className="btn btn-ghost absolute right-3 top-3"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="p-4 font-semibold">{video.title}</p>
    </div>
  );
}
