import { SessionJoinButton } from "@/components/SessionJoin";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { CATEGORIES, EQUIPMENT, FRIENDLY, TRAINING_TIMES, encodeEquipment } from "@/lib/data";
import { validateBreaks, BREAK_LENGTHS } from "@/lib/adBreaks";
import { useStore, type MealPlan, type TrainerVideo } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { MenuBoard } from "@/components/MenuBoard";
import { getPayoutStatus, startPayoutOnboarding } from "@/lib/payouts.functions";
import { RolePicker, CertManager, YouthConsent, useYouthStatus } from "@/components/CoachCredentials";
import { useCloudMenu, useShares, shareCode } from "@/lib/menus";
import { useUserId } from "@/lib/community";
import type { BusyRow } from "@/lib/availability";
import { supabase } from "@/integrations/supabase/client";
import { FITNESS_GOALS, goalsOf } from "@/lib/fitness-goals";
import { isLaunchWorkout } from "@/lib/launch";
import { MultiDropdown } from "@/components/WorkoutFilters";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Trainer Studio — Tryumph Gym" },
      { name: "description", content: "Analytics, calendar, on-demand uploads, Trybe store and client menus for Tryumph trainers." },
      { property: "og:title", content: "Trainer Studio — Tryumph Gym" },
      { property: "og:description", content: "Run your fitness business from one place." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

const UNLOCK = 5;
const TABS = ["Overview", "Calendar", "On-demand", "Store", "Credentials"] as const;

function Studio() {
  const { s } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [certStatus, setCertStatus] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("certifications").select("status").then(({ data }) => setCertStatus((data ?? []).map((r) => r.status)));
  }, [s.signedIn]);
  if (!s.signedIn || s.role !== "trainer") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold">Trainer Studio</h1>
        <p className="mt-2 text-muted-foreground">Sign in with a trainer account to manage classes and earnings.</p>
        <div className="mt-6 flex justify-center gap-2"><Link to="/account" className="btn btn-primary">Go to account</Link><Link to="/for-trainers" className="btn btn-ghost">Why teach on Tryumph</Link></div>
      </div>
    );
  }
  const tr = s.extra.trainer;
  const verified = certStatus.includes("verified") || tr.certs.some((c) => c.status === "Verified");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Trainer Studio" title="Your business at a glance" sub="Sample numbers shown until real payouts are connected.">
        <span className={`chip ${verified ? "chip-active" : ""}`}><ShieldCheck className="mr-1 inline h-4 w-4" />{verified ? "Verified Pro" : tr.certs.length ? "Certifications pending review" : "Add certifications"}</span>
      </PageHeader>
      <div className="flex flex-wrap gap-2">{TABS.filter((t) => tr.kind !== "Nutritionist" || t !== "On-demand").map((t) => <button key={t} className={`chip ${tab === t ? "chip-active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Overview" && <Overview />}
      {tab === "Calendar" && <CalendarTab />}
      {tab === "On-demand" && tr.kind !== "Nutritionist" && <Uploads />}
      {tab === "Store" && <StoreTab />}
      {tab === "Credentials" && <div className="card space-y-6 p-6"><RolePicker /><CertManager /><p className="text-xs text-muted-foreground">Finished a new course? Add it here — we review it and it shows on your profile once verified.</p></div>}
    </div>
  );
}

function NutritionOverview() {
  const { s } = useStore();
  const stats = [["1-on-1 consults (month)", String(s.bookings.length)], ["Rate per session", `$${s.extra.trainer.rate}`], ["Certifications", String(s.extra.trainer.certs.length)], ["Specialties", String(s.extra.trainer.specialties.length)]];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">{stats.map(([k, v]) => <div key={k} className="card p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></div>)}</div>
      <div className="card p-5 text-sm text-muted-foreground">Your nutrition business runs on 1-on-1 consults. When a client books you, their meal plan appears under Client menus so you can shape it. Want to teach live classes too? Add "Trainer" under the Credentials tab.</div>
    </div>
  );
}

function Overview() {
  const { s, set, uid } = useStore();
  const me = useUserId();
  const [f, setF] = useState({ title: "", category: "Strength", level: "Beginner", when: "", description: "" });
  const [live, setLive] = useState(false);
  const unlocked = s.extra.trainer.videos.length >= UNLOCK;
  const [st, setSt] = useState<Awaited<ReturnType<typeof getPayoutStatus>> | null>(null);
  useEffect(() => { getPayoutStatus().then(setSt).catch(() => setSt(null)); }, []);
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const livesHeld = s.scheduled.filter((x) => new Date(x.when).getTime() < Date.now()).length;
  const att = st?.stats.liveAttendanceMonth ?? 0;
  const analytics = [
    ["Live attendance (30 days)", String(att)],
    ["Avg per live", livesHeld ? String(Math.round(att / livesHeld)) : "0"],
    ["Ad revenue share", money(st?.bySource.ads ?? 0)],
    ["1-on-1 earnings", money(st?.bySource.oneonone ?? 0)],
    ["1-on-1 sessions", String(st?.stats.oneononeSessions ?? 0)],
    ["Followers", String(st?.stats.followers ?? 0)],
    ["Trybe members", String(st?.stats.trybeMembers ?? 0)],
    ["On-demand videos", String(s.extra.trainer.videos.length)],
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {analytics.map(([l, v]) => <div key={l} className="card p-5"><p className="font-display text-3xl font-bold">{v}</p><p className="text-sm text-muted-foreground">{l}</p></div>)}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Payouts />
        <section className="card space-y-3 p-6">
          <h2 className="text-xl font-bold">Schedule a live class</h2>
          {!unlocked ? (
            <div className="rounded-xl bg-secondary p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />Lives unlock after {UNLOCK} on-demand videos</p>
              <div className="mt-2 h-2 rounded-full bg-background"><div className="h-2 rounded-full bg-brand" style={{ width: `${(s.extra.trainer.videos.length / UNLOCK) * 100}%` }} /></div>
              <p className="mt-2 text-muted-foreground">Videos uploaded: {s.extra.trainer.videos.length}/{UNLOCK}</p>
            </div>
          ) : (
            <>
              <input className="field" placeholder="Class title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                <select className="field" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{["Beginner", "Intermediate", "Advanced", "Postpartum", "All levels"].map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <input type="datetime-local" className="field" value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} />
              <textarea className="field" placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
              <button className="btn btn-primary w-full" disabled={!f.title || !f.when} onClick={() => {
                set((x) => ({ ...x, scheduled: [...x.scheduled, { ...f, id: uid() }], extra: { ...x.extra, trainer: { ...x.extra.trainer, blocks: [...x.extra.trainer.blocks, { id: uid(), date: f.when.slice(0, 10), label: `Live: ${f.title}`, kind: "live", time: f.when.slice(11, 16) || undefined }] } } }));
                if (me) void supabase.from("live_sessions").insert({ trainer_id: me, trainer_name: s.name, title: f.title, category: f.category, level: f.level, starts_at: new Date(f.when).toISOString(), description: f.description }).then(({ error }) => { if (error) toast.error("Couldn't publish to the Live page."); });
                if (me) void supabase.from("trainer_busy").upsert({ trainer_id: me, day: f.when.slice(0, 10), time: f.when.slice(11, 16) || "ALL", source: "live" }).then(() => {});
                setF({ title: "", category: "Strength", level: "Beginner", when: "", description: "" });
                supabase.auth.getUser().then(({ data: u }) => { if (u.user) supabase.from("posts").insert({ author_id: u.user.id, author_name: s.name, trybe: `coach-${u.user.id}`, kind: "New live", text: `New live class: ${f.title} · ${new Date(f.when).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}${f.description ? ` — ${f.description}` : ""}` }).then(() => {}); });
                toast.success("Class scheduled — your Trybe has been notified");
              }}>Schedule</button>
              <button className={`btn w-full ${live ? "btn-outline" : "btn-ghost"}`} onClick={() => setLive(!live)}>{live ? "End broadcast" : "Go live now"}</button>
            </>
          )}
        </section>
      </div>
      {live && me && <HostRoom me={me} name={s.name} onLeave={() => setLive(false)} />}
      <p className="text-sm text-muted-foreground">Moderate your Trybe (pin and remove posts) on the <Link to="/trybes" className="text-primary">Trybes</Link> page, and reply to reviews on your profile.</p>
    </div>
  );
}

function Payouts() {
  const [st, setSt] = useState<Awaited<ReturnType<typeof getPayoutStatus>> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getPayoutStatus().then(setSt).catch(() => setSt(null));
    const p = new URLSearchParams(window.location.search).get("payouts");
    if (p === "done") toast.success("Bank details saved — we're confirming them with Stripe.");
  }, []);
  const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
  return (
    <section className="card p-6">
      <h2 className="text-xl font-bold">Earnings &amp; payouts</h2>
      <p className="mt-1 text-sm text-muted-foreground">All payouts are after card processing fees: 90% of 1-on-1s, 50% of live-class tokens, 50% of ad revenue.</p>
      <div className="mt-4 divide-y text-sm">
        {([["1-on-1 sessions (90%)", st?.bySource.oneonone ?? 0], ["Live tokens (50%)", st?.bySource.live ?? 0], ["On-demand ads (50%)", st?.bySource.ads ?? 0]] as const).map(([l, c]) => <div key={l} className="flex justify-between py-3"><span>{l}</span><span>{$(c)}</span></div>)}
        <div className="flex justify-between py-3 text-muted-foreground"><span>Processing fees deducted (before split)</span><span>{$(st?.fees ?? 0)}</span></div>
        <div className="flex justify-between py-3 font-bold"><span>Waiting to be paid</span><span className="text-primary">{$(st?.pending ?? 0)}</span></div>
        <div className="flex justify-between py-3"><span>Paid to your bank</span><span>{$(st?.paid ?? 0)}</span></div>
      </div>
      {st?.enabled ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4" />Bank linked — 1-on-1s pay out automatically, lives and ads in each payout run.</p>
      ) : (
        <button className="btn btn-primary mt-2" disabled={busy} onClick={async () => {
          setBusy(true);
          try { const r = await startPayoutOnboarding(); if (r.url) window.location.href = r.url; }
          catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't start payout setup"); setBusy(false); }
        }}>{busy ? "Opening…" : st?.linked ? "Finish bank setup" : "Link your bank for payouts"}</button>
      )}
    </section>
  );
}

const toSecs = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const [m, sec] = x.split(":"); return (+m! || 0) * 60 + (+(sec ?? 0) || 0); }).filter((n) => n > 0);

function CalendarTab() {
  const { s, setExtra, uid } = useStore();
  const me = useUserId();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("ALL");
  const [booked, setBooked] = useState<BusyRow[]>([]);
  const blocks = s.extra.trainer.blocks;
  // Whatever is blocked here is what the 1-on-1 booking widget on your profile refuses to sell.
  const publish = (day: string, time: string, source: string) => { if (me) void supabase.from("trainer_busy").upsert({ trainer_id: me, day, time, source }).then(() => {}); };
  const unpublish = (day: string, time: string) => { if (me) void supabase.from("trainer_busy").delete().eq("trainer_id", me).eq("day", day).eq("time", time).then(() => {}); };
  const loadBooked = () => { if (me) void supabase.from("trainer_busy").select("day, time, source").eq("trainer_id", me).eq("source", "booked").then(({ data }) => setBooked((data ?? []) as BusyRow[])); };
  useEffect(() => {
    if (!me) return;
    blocks.forEach((b) => publish(b.date, b.time ?? "ALL", b.kind === "live" ? "live" : "personal"));
    loadBooked();
  }, [me]);
  const oneOnOnes = booked.map((b) => ({ id: `${b.day}-${b.time}`, date: b.day, label: b.time === "ALL" ? "1-on-1 booked" : `1-on-1 ${b.time}`, kind: "oneonone" as const }));
  const all = [...blocks, ...oneOnOnes];
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = month.getDay();
  const iso = (d: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const color = { live: "bg-primary/20 text-primary", oneonone: "bg-accent/20 text-accent", personal: "bg-secondary text-muted-foreground" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
        <p className="font-display text-xl font-bold">{month.toLocaleString("en-US", { month: "long", year: "numeric" })}</p>
        <button className="btn btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        <div className="ml-auto flex flex-wrap gap-2">
          <input type="date" className="field w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="field w-auto" value={slot} onChange={(e) => setSlot(e.target.value)} aria-label="Time to block">
            <option value="ALL">All day</option>
            {TRAINING_TIMES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="field w-auto" placeholder="Personal time (e.g. School pickup)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn btn-primary" disabled={!date} onClick={() => {
            const time = slot;
            setExtra((x) => ({ ...x, trainer: { ...x.trainer, blocks: [...x.trainer.blocks, { id: uid(), date, label: `${label || "Unavailable"}${time === "ALL" ? "" : ` ${time}`}`, kind: "personal", time: time === "ALL" ? undefined : time }] } }));
            publish(date, time, "personal");
            setLabel(""); toast.success("Blocked — clients can't book 1-on-1s then");
          }}>Block time</button>
          <button className="btn btn-ghost" onClick={loadBooked}>Refresh</button>
        </div>
      </div>
      <div className="flex gap-3 text-xs"><span className={`rounded px-2 py-0.5 ${color.live}`}>Live class</span><span className={`rounded px-2 py-0.5 ${color.oneonone}`}>1-on-1 booked by a client</span><span className={`rounded px-2 py-0.5 ${color.personal}`}>Personal / blocked</span></div>
      <p className="text-xs text-muted-foreground">Booked 1-on-1s and blocked time both come from your cloud calendar, so a client can't pay for a slot you've already taken.</p>
      {me && booked.filter((b) => b.time !== "ALL" && b.day >= new Date().toISOString().slice(0, 10)).length > 0 && (
        <div className="card space-y-2 p-4">
          <p className="font-semibold">Upcoming 1-on-1 sessions</p>
          {booked.filter((b) => b.time !== "ALL" && b.day >= new Date().toISOString().slice(0, 10)).sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`)).map((b) => (
            <div key={`${b.day}-${b.time}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{b.day} at {b.time}</span>
              <SessionJoinButton trainerId={me} date={b.day} time={b.time} title="1-on-1 session" hostName={s.name} />
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <p key={d} className="p-1 text-center text-muted-foreground">{d}</p>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1; const items = all.filter((b) => b.date === iso(d));
          return (
            <div key={d} className="card min-h-20 p-1.5">
              <p className="font-semibold">{d}</p>
              {items.map((b) => <button key={b.id} title={b.kind === "oneonone" ? "Booked by a client — remove it from the client's side" : "Click to remove"} onClick={() => {
                if (b.kind === "oneonone") return;
                const blk = blocks.find((y) => y.id === b.id);
                setExtra((x) => ({ ...x, trainer: { ...x.trainer, blocks: x.trainer.blocks.filter((y) => y.id !== b.id) } }));
                unpublish(b.date, blk?.time ?? "ALL");
              }} className={`mt-1 block w-full truncate rounded px-1 text-left ${color[b.kind]}`}>{b.label}</button>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Uploads() {
  const { s, setExtra, uid } = useStore();
  const me = useUserId();
  const [f, setF] = useState({ title: "", category: "Strength", level: "Beginner", minutes: "20", breaks: "", gear: [] as string[], friendly: [] as string[], goals: [] as string[], pregnancySafe: false, playlist: "", newPl: "", breakSecs: 15 });
  const myPlaylists = [...new Set(s.extra.trainer.videos.map((v) => v.playlist).filter(Boolean) as string[])];
  const breakErr = validateBreaks(toSecs(f.breaks), +f.minutes || 0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const vids = s.extra.trainer.videos.filter(isLaunchWorkout);
  useEffect(() => {
    if (!me) return;
    supabase.from("trainer_videos").select("id,title,category,level,minutes,path,equipment,pregnancy_safe,playlist").eq("user_id", me).then(({ data, error }) => {
      if (error || !data) return;
      setExtra((x) => ({ ...x, trainer: { ...x.trainer, videos: data.map((v) => ({ ...v, pregnancySafe: v.pregnancy_safe, goals: goalsOf(v) })) } }));
    });
  }, [me]);
  const youth = useYouthStatus().status;
  const youthLocked = youth === "pending" || youth === "rejected";
  const publish = async () => {
    if (!me || !file) return;
    if (youthLocked) { toast.error("Uploads open once the Tryumph team approves your guardian consent."); return; }
    if (breakErr) { toast.error(breakErr); return; }
    const playlist = (f.playlist === "__new" ? f.newPl : f.playlist).trim();
    const MAX = 3 * 1024 * 1024 * 1024;
    if (file.size > MAX) { toast.error(`That file is ${(file.size / 1024 / 1024 / 1024).toFixed(1)} GB — the limit is 3 GB. Re-record in 720p or trim it.`); return; }
    setBusy(true);
    const path = `${me}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("videos").upload(path, file);
    if (up.error) { setBusy(false); toast.error("Upload failed — try a smaller file (max 3 GB)."); return; }
    const equipment = encodeEquipment(f.gear, f.friendly, f.goals);
    const ins = await supabase.from("trainer_videos").insert({ user_id: me, title: f.title, category: f.category, level: f.level, path, minutes: +f.minutes || 0, breaks: toSecs(f.breaks), equipment, pregnancy_safe: f.pregnancySafe, playlist, break_seconds: f.breakSecs }).select("id").single();
    if (ins.error || !ins.data) { setBusy(false); await supabase.storage.from("videos").remove([path]); toast.error("Couldn't publish your workout. Your selections are saved here so you can retry."); return; }
    const id = ins.data.id;
    setExtra((x) => ({ ...x, trainer: { ...x.trainer, videos: [...x.trainer.videos, { id, title: f.title, category: f.category, level: f.level, minutes: +f.minutes || 0, path, equipment, goals: f.goals, pregnancySafe: f.pregnancySafe, playlist }] } }));
    setF({ ...f, title: "", breaks: "", newPl: "", goals: [], playlist }); setFile(null); setBusy(false);
    toast.success("Video uploaded and published");
  };
  const drop = async (v: TrainerVideo) => {
    if (!me) return;
    let ids: string[] = [];
    let obj = v.path;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)) {
      const { data } = await supabase.from("trainer_videos").select("id, path").eq("id", v.id).maybeSingle();
      if (data) { ids = [data.id]; obj = obj ?? data.path; }
    }
    if (!ids.length) {
      const { data } = await supabase.from("trainer_videos").select("id, path").eq("user_id", me).eq("title", v.title);
      ids = (data ?? []).map((r) => r.id);
      obj = obj ?? data?.[0]?.path;
    }
    if (ids.length) await supabase.from("trainer_videos").delete().in("id", ids);
    if (obj) await supabase.storage.from("videos").remove([obj]);
    setExtra((x) => ({ ...x, trainer: { ...x.trainer, videos: x.trainer.videos.filter((y) => y.id !== v.id) } }));
    toast.success("Video removed from your library");
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-3 p-6">
        <h2 className="text-xl font-bold">Upload an on-demand workout</h2>
        <p className="text-sm text-muted-foreground">{vids.length >= UNLOCK ? "Live classes unlocked 🎉" : `${UNLOCK - vids.length} more to unlock live classes.`}</p>
        {youthLocked && <p className="rounded-lg bg-secondary p-3 text-sm text-warning">Youth Ambassador uploads are locked until the Tryumph team approves your parent/guardian consent.</p>}
        <input type="file" accept="video/*" className="field" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-muted-foreground">Max 3 GB. A 45-minute class in 720p lands near 1 GB; in 1080p it runs 2–3 GB. Phone recordings are usually fine.</p>
        <input className="field" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <div className="grid grid-cols-3 gap-3">
          <select className="field" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="field" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>{["Beginner", "Intermediate", "Advanced", "Postpartum"].map((c) => <option key={c}>{c}</option>)}</select>
          <input type="number" className="field" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} placeholder="min" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><MultiDropdown label="Fitness goals" values={f.goals} options={FITNESS_GOALS} emptyLabel="Choose goals" onChange={(goals) => setF({ ...f, goals })} /></div>
          <div className="col-span-2 text-sm font-medium">Equipment needed<div className="mt-1 flex flex-wrap gap-2">{EQUIPMENT.filter((c) => c !== "No equipment").map((c) => <button type="button" key={c} className={`chip ${f.gear.includes(c) ? "chip-active" : ""}`} onClick={() => setF({ ...f, gear: f.gear.includes(c) ? f.gear.filter((y) => y !== c) : [...f.gear, c] })}>{c}</button>)}</div></div>
          <div className="col-span-2 text-sm font-medium">Good for<div className="mt-1 flex flex-wrap gap-2">{FRIENDLY.map((c) => <button type="button" key={c} className={`chip ${f.friendly.includes(c) ? "chip-active" : ""}`} onClick={() => setF({ ...f, friendly: f.friendly.includes(c) ? f.friendly.filter((y) => y !== c) : [...f.friendly, c] })}>{c}</button>)}</div></div>
          <label className="text-sm font-medium">Playlist<select className="field mt-1" value={f.playlist} onChange={(e) => setF({ ...f, playlist: e.target.value })}><option value="">None</option>{myPlaylists.map((p) => <option key={p}>{p}</option>)}<option value="__new">+ New playlist</option></select></label>
        </div>
        {f.playlist === "__new" && <input className="field" placeholder="New playlist name" value={f.newPl} onChange={(e) => setF({ ...f, newPl: e.target.value })} />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={f.pregnancySafe} onChange={(e) => setF({ ...f, pregnancySafe: e.target.checked })} />Pregnancy safe</label>
        <label className="block text-sm font-medium">Rest / water breaks
          <input className="field mt-1" placeholder="e.g. 12:30, 25:00, 38:15" value={f.breaks} onChange={(e) => setF({ ...f, breaks: e.target.value })} />
        </label>
        <div className="flex items-center gap-2 text-sm">Break length {BREAK_LENGTHS.map((n) => <button key={n} type="button" className={`chip ${f.breakSecs === n ? "chip-active" : ""}`} onClick={() => setF({ ...f, breakSecs: n })}>{n}s</button>)}</div>
        {breakErr && f.breaks && <p className="text-sm text-destructive">{breakErr}</p>}
        <p className="text-xs text-muted-foreground">Rules: no breaks in the first 3 or last 2 minutes, and at least 5 minutes apart. Ads only ever play at the moments you mark here — never mid-set. Leave blank for an ad-free video. Your 50% ad share is paid after fees.</p>
        <button className="btn btn-primary w-full" disabled={!f.title || !file || busy || (!!f.breaks && !!breakErr)} onClick={publish}>{busy ? "Uploading…" : "Upload & publish"}</button>
      </section>
      <section className="card p-6">
        <h2 className="text-xl font-bold">Your library ({vids.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">{vids.map((v) => <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2"><span>{v.title}{goalsOf(v).length > 0 && <span className="block text-xs text-muted-foreground">{goalsOf(v).join(" · ")}</span>}</span><span className="flex items-center gap-3 text-muted-foreground">{v.category} · {v.level} · {v.minutes}m<button className="text-destructive" onClick={() => drop(v)}>Remove</button></span></li>)}</ul>
      </section>
    </div>
  );
}

function StoreTab() {
  const { s, setExtra, uid } = useStore();
  const [f, setF] = useState({ name: "", price: "", url: "" });
  const items = s.extra.trainer.store;
  return (
    <section className="card space-y-3 p-6">
      <h2 className="text-xl font-bold">Your Trybe Store</h2>
      <div className="flex flex-wrap gap-2">
        <input className="field flex-1" placeholder="Product (tee, band set, recipe guide…)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input type="number" className="field w-28" placeholder="$" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <input className="field flex-1" placeholder="Link to your shop (optional — Solin, your site…)" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
        <button className="btn btn-primary" disabled={!f.name || !+f.price} onClick={() => { setExtra((x) => ({ ...x, trainer: { ...x.trainer, store: [...x.trainer.store, { id: uid(), name: f.name, price: +f.price, ...(f.url.trim() ? { url: f.url.trim() } : {}) }] } })); setF({ name: "", price: "", url: "" }); }}>Add product</button>
      </div>
      <ul className="space-y-2 text-sm">{items.map((i) => <li key={i.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2"><span>{i.name}{i.url && <span className="ml-2 text-xs text-primary">↗ linked</span>}</span><span className="flex items-center gap-3">${i.price}<button className="text-destructive" onClick={() => setExtra((x) => ({ ...x, trainer: { ...x.trainer, store: x.trainer.store.filter((y) => y.id !== i.id) } }))}>Remove</button></span></li>)}</ul>
      <p className="text-xs text-muted-foreground">Your products appear in the Store & Merch section of your coach profile. Add a link to send buyers to your own shop — sales there are 100% yours. An affiliate disclosure is shown next to linked products automatically.</p>
    </section>
  );
}

const sampleClients: { name: string; note: string; plan: MealPlan }[] = [
  { name: "Jess R.", note: "Postpartum 14 weeks · 2 finger DR gap · low impact · breastfeeding", plan: { Mon: { Breakfast: [{ id: "a", title: "Overnight Protein Oats", kcal: 380, protein: 28, carbs: 48, fat: 9 }] } } },
  { name: "Marcus T.", note: "Muscle gain · no dairy", plan: {} },
];

function ClientMenus() {
  const { s } = useStore();
  const me = useUserId();
  const { shares, reload } = useShares(me);
  const clients = shares.filter((x) => x.nutritionist_id === me);
  const [sel, setSel] = useState<string | null>(null);
  const cur = clients.find((c) => c.client_id === sel) ?? clients[0];
  const { menu, save } = useCloudMenu(cur?.client_id ?? null);
  const target = menu?.target ?? { kcal: 2000, protein: 110 };
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="flex-1">Clients share their weekly menu with you using your code. Give it to them after booking.</span>
        <span className="chip chip-active font-mono text-base">{me ? shareCode(me) : "…"}</span>
        <button className="btn btn-ghost" onClick={() => { if (me) { void navigator.clipboard.writeText(shareCode(me)); toast.success("Code copied"); } }}>Copy</button>
        <button className="btn btn-ghost" onClick={() => void reload()}>Refresh</button>
      </div>
      {clients.length === 0 ? <p className="card p-8 text-center text-muted-foreground">No clients have shared a menu with you yet.</p> : (
        <>
          <div className="flex flex-wrap gap-2">{clients.map((x) => <button key={x.client_id} className={`chip ${cur?.client_id === x.client_id ? "chip-active" : ""}`} onClick={() => setSel(x.client_id)}>{x.client_name}</button>)}</div>
          <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="flex-1">{menu?.approved_by ? `Approved by ${menu.approved_by}` : "Not approved yet"}</span>
            <label>Calories<input type="number" className="field ml-2 inline w-24" value={target.kcal} onChange={(e) => save({ target: { ...target, kcal: +e.target.value } })} /></label>
            <label>Protein<input type="number" className="field ml-2 inline w-20" value={target.protein} onChange={(e) => save({ target: { ...target, protein: +e.target.value } })} /></label>
            <button className="btn btn-primary" onClick={() => { save({ approved_by: s.name, approved_at: new Date().toISOString() }); toast.success(`Plan marked Nutritionist Approved for ${cur!.client_name}`); }}>Mark approved</button>
          </div>
          <MenuBoard plan={menu?.plan ?? {}} target={target} editor={s.name} onChange={(p) => save({ plan: p })} />
        </>
      )}
    </div>
  );
}

const LiveRoomLazy = lazy(() => import("@/components/LiveRoom"));
function HostRoom({ me, name, onLeave }: { me: string; name: string; onLeave: () => void }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  useEffect(() => {
    // Join the room for the coach's next class (starting within the hour), or their personal room.
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    supabase.from("live_sessions").select("id").eq("trainer_id", me).gte("starts_at", recent).lte("starts_at", soon).order("starts_at").limit(1)
      .then(({ data }) => setRoomId(data?.[0] ? `live-${data[0].id}` : `live-coach-${me}`));
  }, [me]);
  if (!roomId) return <div className="card grid aspect-video place-items-center"><p className="text-muted-foreground">Opening your room…</p></div>;
  return (
    <ClientOnly fallback={null}>
      <Suspense fallback={<div className="card grid aspect-video place-items-center"><p className="text-muted-foreground">Loading the room…</p></div>}>
        <LiveRoomLazy roomId={roomId} title="Live class" hostName={name} onLeave={onLeave} isHost />
      </Suspense>
    </ClientOnly>
  );
}
