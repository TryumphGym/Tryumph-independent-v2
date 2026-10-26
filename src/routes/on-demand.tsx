import { WaterBreakSponsor } from '@/components/WaterBreakSponsor';
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, BookmarkCheck, Droplets, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { CATEGORIES, LEVELS, EQUIPMENT, DURATIONS, gearOf, friendlyOf, fitScore, videos, trainerById, type Video } from "@/lib/data";
import { thumbFor } from "@/lib/thumbs";
import { useStore } from "@/lib/store";
import { getVideoUrl } from "@/lib/videos.functions";
import { PageHeader } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { ChoiceDropdown, MultiDropdown } from "@/components/WorkoutFilters";
import { matchesWorkout, isSafetyCompatible, SAFETY_OPTIONS, type WorkoutMatch, type WorkoutPreferences } from "@/lib/workout-preferences";

export const Route = createFileRoute("/on-demand")({
  validateSearch: z.object({ v: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Free On-Demand Workouts — Tryumph Gym" },
      { name: "description", content: "Stream strength, core, yoga, mobility, HIIT and pilates for free. No login needed." },
      { property: "og:title", content: "Free On-Demand Workouts — Tryumph Gym" },
      { property: "og:description", content: "Free workouts with ads only during water breaks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnDemand,
});

function OnDemand() {
  const { v } = Route.useSearch();
  const navigate = useNavigate();
  const { s, toggleWatchLater } = useStore();
  const [cat, setCat] = useState<string[]>([]);
  const [lvl, setLvl] = useState("All levels");
  const [eq, setEq] = useState<string[]>([]);
  const [needs, setNeeds] = useState<string[]>([]);
  const owned = s.extra.gear ?? [];
  const [dur, setDur] = useState("Any length");
  const preferences = s.signedIn
    ? { level: s.profile.level, styles: s.extra.styles ?? [], gear: owned, needs: s.extra.conditions, quiet: s.extra.quiet ?? false, pregnant: s.extra.pregnant ?? false, postpartum: s.profile.postpartum }
    : { level: lvl, styles: cat, gear: eq, needs, quiet: false };
  const accepts = (x: WorkoutMatch & { minutes: number }) => {
    const duration = DURATIONS.find((d) => d.label === dur);
    return matchesWorkout(x, preferences) && (!duration || (x.minutes >= duration.min && x.minutes <= duration.max));
  };
  const [tab, setTab] = useState<"all" | "later" | "history" | "playlists">("all");
  const [pl, setPl] = useState<string | null>(null);
  const playlists = [...new Set(videos.map((x) => x.playlist).filter(Boolean) as string[])];
  const current = videos.find((x) => x.id === v);

  const base = tab === "playlists" ? (pl ? videos.filter((x) => x.playlist === pl) : []) : tab === "later" ? videos.filter((x) => s.watchLater.includes(x.id)) : tab === "history" ? s.history.flatMap((h) => { const video = videos.find((x) => x.id === h); return video ? [video] : []; }) : videos;
  const list = base
    .filter(accepts)
    .sort((a, b) => (s.signedIn ? fitScore(b, owned, s.extra.conditions) - fitScore(a, owned, s.extra.conditions) : 0));
  const saveLater = (id: string) => {
    if (!s.signedIn) { toast("Create a free account to save workouts to your watchlist.", { action: { label: "Sign up", onClick: () => navigate({ to: "/account" }) } }); return; }
    toggleWatchLater(id);
  };

  return (
    <div>
      <PageHeader eyebrow="Free · No login needed" title="On-Demand Library" sub="Ads only play during water breaks, so your momentum is never interrupted." />
      <div className="card mb-6 border-primary/40 p-4 text-sm"><span className="font-semibold">🎬 Preview:</span> These are placeholder images, not real videos yet. Real workouts from our founding coaches are coming soon!</div>
      {current && <Player video={current} onClose={() => navigate({ to: "/on-demand", search: {} })} />}
      <div className="mb-4 flex flex-wrap gap-2">
        {(s.signedIn ? (["all", "playlists", "later", "history"] as const) : (["all", "playlists"] as const)).map((t) => (
          <Button key={t} onClick={() => setTab(t)} variant={tab === t ? "secondary" : "ghost"}>{t === "all" ? "Library" : t === "playlists" ? "Playlists" : t === "later" ? `Watch Later (${s.watchLater.length})` : "History"}</Button>
        ))}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {!s.signedIn && <>
          <ChoiceDropdown label="Level" value={lvl} options={["All levels", ...LEVELS]} onChange={setLvl} />
          <MultiDropdown label="Style" values={cat} options={CATEGORIES} emptyLabel="All styles" onChange={setCat} />
          <MultiDropdown label="Gear" values={eq} options={EQUIPMENT} emptyLabel="Any equipment" exclusive="No equipment" onChange={setEq} />
          <MultiDropdown label="Safety" values={needs} options={SAFETY_OPTIONS} emptyLabel="No preferences" onChange={setNeeds} />
        </>}
        <ChoiceDropdown label="Time" value={dur} options={["Any length", ...DURATIONS.map((d) => d.label)]} onChange={setDur} />
        {s.signedIn && <div className="flex items-end"><Button asChild variant="ghost"><Link to="/account">Workout preferences</Link></Button></div>}
      </div>
      {tab === "all" && <TrainerUploads accepts={accepts} preferences={preferences} />}
      {tab === "playlists" && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {playlists.map((name) => { const vs = videos.filter((x) => x.playlist === name); return (
            <button key={name} onClick={() => setPl(name)} className={`card p-4 text-left ${pl === name ? "ring-2 ring-primary" : ""}`}>
              <p className="font-semibold">{name}</p>
              <p className="text-sm text-muted-foreground">{vs.length} workouts · {vs.reduce((a, x) => a + x.minutes, 0)} min · {vs[0] ? trainerById(vs[0].trainerId)?.name : ""}</p>
            </button>); })}
        </div>
      )}
      {tab === "playlists" && !pl ? null : list.length === 0 && <p className="card p-8 text-center text-muted-foreground">No workouts match those filters yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((x) => (
          <div key={x.id} className="card overflow-hidden">
            <button onClick={() => navigate({ to: "/on-demand", search: { v: x.id } })} className="group relative block aspect-video w-full overflow-hidden" aria-label={`Play ${x.title}`}>
              <img src={thumbFor(x.category)} alt="" loading="lazy" width={1088} height={608} className="h-full w-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-0 grid place-items-center bg-background/20"><span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"><Play className="h-5 w-5" /></span></span>
              <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold">Preview · {x.minutes} min</span>
            </button>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="eyebrow">{x.category} · {x.level}{x.postpartum ? " · Postpartum" : ""}{x.pregnancySafe ? " · Pregnancy safe" : ""}</p>
                  <p className="mt-1 font-semibold">{x.title}</p>
                  <p className="text-sm text-muted-foreground">{trainerById(x.trainerId).name} · {x.minutes} min · {gearOf(x.equipment).join(", ") || "No equipment"}{friendlyOf(x).length ? ` · ${friendlyOf(x).join(", ")}` : ""}</p>
                  {x.playlist && <p className="mt-1 text-xs text-accent">Playlist: {x.playlist}</p>}
                  {x.playlist && <p className="mt-1 flex gap-2 text-xs"><a onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="underline text-muted-foreground" href={`https://open.spotify.com/search/${encodeURIComponent(x.playlist + " workout")}`}>Spotify</a><a onClick={(e) => e.stopPropagation()} target="_blank" rel="noreferrer" className="underline text-muted-foreground" href={`https://music.apple.com/us/search?term=${encodeURIComponent(x.playlist + " workout")}`}>Apple Music</a></p>}
                </div>
                <button onClick={() => saveLater(x.id)} aria-label="Save for later" className="text-primary">
                  {s.watchLater.includes(x.id) ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Uploaded = { id: string; title: string; category: string; level: string; path: string; minutes: number; breaks: number[]; equipment: string; pregnancy_safe: boolean; playlist: string; break_seconds: number; required_equipment?: string[]; optional_equipment?: string[] };

function TrainerUploads({ accepts, preferences }: { accepts: (video: WorkoutMatch & { minutes: number }) => boolean; preferences: WorkoutPreferences }) {
  const [rows, setRows] = useState<Uploaded[]>([]);
  const [open, setOpen] = useState<Uploaded | null>(null);
  useEffect(() => {
    supabase.from("trainer_videos").select("id,title,category,level,path,minutes,breaks,equipment,pregnancy_safe,playlist,break_seconds,required_equipment,optional_equipment").eq("review_status", "approved").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setRows((data ?? []) as Uploaded[]));
  }, []);
  const normalized = (x: Uploaded): WorkoutMatch & { minutes: number } => ({ ...x, pregnancySafe: x.pregnancy_safe, postpartum: x.level === "Postpartum" });
  const safe = rows.filter(x => isSafetyCompatible(normalized(x), preferences));
  const best = safe.filter(x => accepts(normalized(x)));
  const close = safe.filter(x => !best.includes(x) && (
    (!preferences.styles.length || preferences.styles.includes(x.category)) ||
    (preferences.gear.length === 0 || (x.required_equipment ?? []).every(g => preferences.gear.includes(g)))
  ));
  const explore = safe.filter(x => !best.includes(x) && !close.includes(x));
  if (!rows.length) return <p className="card mb-8 p-6 text-muted-foreground">Approved trainer workouts will appear here once available.</p>;
  const renderGroup = (title: string, description: string, group: Uploaded[]) => (
    <section className="mb-7" key={title}>
      <h2 className="mb-2 text-xl font-bold">{title} ({group.length})</h2>
      <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      {group.length === 0 ? <p className="text-sm text-muted-foreground">No workouts in this group yet.</p> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{group.map(x => (
          <button key={x.id} onClick={() => setOpen(x)} className="card overflow-hidden text-left">
            <div className="bg-brand grid aspect-video w-full place-items-center"><Play className="h-8 w-8 text-primary-foreground" /></div>
            <div className="p-4"><p className="eyebrow">{x.category} · {x.level}{x.pregnancy_safe ? " · Pregnancy safe" : ""}</p>
              <p className="mt-1 font-semibold">{x.title}</p>
              {x.playlist && <p className="text-xs text-accent">Playlist: {x.playlist}</p>}
              <p className="text-sm text-muted-foreground">{x.minutes} min · {x.equipment || "No equipment listed"} · {(x.breaks ?? []).length ? `${x.breaks.length} water breaks` : "Ad-free"}</p>
            </div>
          </button>
        ))}</div>}
    </section>
  );
  return <section className="mb-8">
    {open && <RealPlayer video={open} onClose={() => setOpen(null)} />}
    {renderGroup("Best Matches", "Workouts matching your selected preferences and safety filters.", best)}
    {renderGroup("Close Matches", "Some preferences differ; review the equipment and level before starting.", close)}
    {renderGroup("Explore All", "More approved workouts that pass your selected safety filters.", explore)}
  </section>;
}

// Plays the real file. Ads appear only when playback reaches a trainer-marked rest/water break.
function RealPlayer({ video, onClose }: { video: Uploaded; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [ad, setAd] = useState(0);
  const [soon, setSoon] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const ref = useRef<HTMLVideoElement>(null);
  const sign = useServerFn(getVideoUrl);
  useEffect(() => {
    setDone(new Set()); setAd(0); setUrl(null);
    sign({ data: { id: video.id } }).then(setUrl).catch(() => setUrl(null));
  }, [video.id]);
  useEffect(() => {
    if (ad <= 0) return;
    const t = setTimeout(() => { if (ad === 1) void ref.current?.play(); setAd(ad - 1); }, 1000);
    return () => clearTimeout(t);
  }, [ad]);
  const onTime = () => {
    const v = ref.current; if (!v || ad > 0) return;
    const hit = video.breaks.find((b) => !done.has(b) && v.currentTime >= b && v.currentTime < b + 2);
    if (hit !== undefined) { v.pause(); setDone(new Set(done).add(hit)); setAd(video.break_seconds || 15); setSoon(false); return; }
    setSoon(video.breaks.some((b) => !done.has(b) && b - v.currentTime > 0 && b - v.currentTime <= 5));
  };
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="relative bg-secondary">
        {url?.startsWith("https://iframe.mediadelivery.net/") ? <iframe src={url} title={video.title} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="aspect-video w-full" /> : url ? <video ref={ref} src={url} controls={ad === 0} autoPlay onTimeUpdate={onTime} className="aspect-video w-full" /> : <div className="grid aspect-video place-items-center text-muted-foreground">Loading…</div>}
        {ad > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-background/95 text-center">
            <div><Droplets className="mx-auto h-10 w-10 text-primary" /><p className="mt-3 font-display text-2xl font-bold">Water break 💧</p><p className="text-muted-foreground">Grab some water — resuming in {ad}s</p><WaterBreakSponsor /><button className="btn btn-ghost mt-3" onClick={() => { setAd(0); void ref.current?.play(); }}>Resume now</button></div>
          </div>
        )}
        {soon && ad === 0 && <div className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">💧 Water break in a few seconds</div>}
        <button onClick={onClose} className="btn btn-ghost absolute right-3 top-3" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <p className="p-4 font-semibold">{video.title}</p>
    </div>
  );
}

function Player({ video, onClose }: { video: Video; onClose: () => void }) {
  const { watch } = useStore();
  const total = video.minutes * 60;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [ad, setAd] = useState(0);
  const breakAt = Math.floor(total / 2);

  useEffect(() => { watch(video.id); setT(0); setAd(0); setPlaying(true); }, [video.id]);
  useEffect(() => {
    if (!playing) return;
    const i = setInterval(() => {
      if (ad > 0) { setAd((a) => a - 1); return; }
      setT((x) => {
        const n = Math.min(total, x + 30); // simulated fast-forward
        if (x < breakAt && n >= breakAt) setAd(5);
        return n;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [playing, ad, total, breakAt]);

  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  return (
    <div className="card mb-8 overflow-hidden">
      <div className="relative grid aspect-video place-items-center overflow-hidden bg-secondary">
        <img src={thumbFor(video.category)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="relative">
        {ad > 0 ? (
          <div className="text-center">
            <Droplets className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-display text-2xl font-bold">Water break 💧</p>
            <p className="text-muted-foreground">Sponsored message · resuming in {ad}s</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="eyebrow">Now playing</p>
            <p className="mt-2 font-display text-3xl font-bold">{video.title}</p>
            <p className="text-muted-foreground">{trainerById(video.trainerId).name}</p>
            <p className="mt-2 text-sm text-muted-foreground">Preview only — placeholder, not a real video. Real coach content coming soon!</p>
          </div>
        )}
        </div>
        <button onClick={onClose} className="btn btn-ghost absolute right-3 top-3" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-4 p-4">
        <button onClick={() => setPlaying(!playing)} className="btn btn-primary">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <div className="relative h-2 flex-1 rounded-full bg-secondary">
          <div className="bg-brand h-2 rounded-full" style={{ width: `${(t / total) * 100}%` }} />
          <div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded bg-warning" style={{ left: "50%" }} title="Water break" />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{fmt(t)} / {fmt(total)}</span>
      </div>
    </div>
  );
}
