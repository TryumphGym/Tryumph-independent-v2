import { MemberSessions } from "@/components/MemberSessions";
import { ActiveMilestones } from "@/components/ActiveMilestones";
import { AccountNoticeCenter } from "@/components/AccountNoticeCenter";
import { RecordingManager } from "@/components/RecordingManager";
import { ClassManager } from "@/components/ClassManager";
import { TrainerWorkoutEditor } from "@/components/TrainerWorkoutEditor";
import {
  TrainerStoreManager,
  TrainerProgramManager,
} from "@/components/TrainerLaunchTools";
import { hasVerifiedCpr, isExpired, isCurrentVerified, type CredentialRecord } from "@/lib/cpr";
import { SessionJoinButton } from "@/components/SessionJoin";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CATEGORIES,
  EQUIPMENT,
  FRIENDLY,
  TRAINING_TIMES,
  encodeEquipment,
} from "@/lib/data";
import { validateBreaks, BREAK_LENGTHS, parseBreaks } from "@/lib/adBreaks";
import { useStore, type MealPlan, type TrainerVideo } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { MenuBoard } from "@/components/MenuBoard";
import {
  getPayoutStatus,
  startPayoutOnboarding,
} from "@/lib/payouts.functions";
import {
  RolePicker,
  CertManager,
  YouthConsent,
  useYouthStatus,
} from "@/components/CoachCredentials";
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
      {
        name: "description",
        content:
          "Analytics, calendar, on-demand uploads, Trybe store and client menus for Tryumph trainers.",
      },
      { property: "og:title", content: "Trainer Studio — Tryumph Gym" },
      {
        property: "og:description",
        content: "Run your fitness business from one place.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

const UNLOCK = 5;
const TABS = [
  "Overview",
  "My Profile",
  "Calendar",
  "On-demand",
  "Store",
  "Credentials",
] as const;

function Studio() {
  const { s } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [certStatus, setCertStatus] = useState<CredentialRecord[]>([]);
  useEffect(() => {
    let active = true;
    if (!s.signedIn) {
      setCertStatus([]);
      return;
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        if (active) setCertStatus([]);
        return;
      }
      const { data } = await supabase
        .from("certifications")
        .select("name,status,expires,verified_at,verified_by")
        .eq("user_id", user.id);
      if (active) setCertStatus((data ?? []) as CredentialRecord[]);
    });
    return () => {
      active = false;
    };
  }, [s.signedIn]);
  if (!s.signedIn || s.role !== "trainer") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-bold">Trainer Studio</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in with a trainer account to manage classes and earnings.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/account" className="btn btn-primary">
            Go to account
          </Link>
          <Link to="/for-trainers" className="btn btn-ghost">
            Why teach on Tryumph
          </Link>
        </div>
      </div>
    );
  }
  const tr = s.extra.trainer;
  const verified = hasVerifiedCpr(certStatus);
  const expiredUnreplaced = certStatus.filter(cert => isExpired(cert.expires) && cert.status === "verified" && !certStatus.some(current => current.name.toLowerCase() === cert.name.toLowerCase() && isCurrentVerified(current)));
  const credentialsPaused = expiredUnreplaced.length > 0;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trainer Studio"
        title="Your business at a glance"
        sub="Your verified trainer account, upcoming classes, video approvals, and earnings."
      >
        <span className={`chip ${verified ? "chip-active" : ""}`}>
          <ShieldCheck className="mr-1 inline h-4 w-4" />
          {verified
            ? "Verified Pro"
            : certStatus.length
              ? "CPR/AED verification required"
              : "Add CPR/AED certification"}
        </span>
      </PageHeader>
      {credentialsPaused && <div role="alert" className="card border-amber-500/60 p-5"><p className="font-bold">Trainer certifications expired — activity paused</p><p className="text-sm">Please update your certification(s) in Credentials to continue uploading new content or hosting live classes. Previously approved videos remain available.</p><p className="mt-2 text-xs">{expiredUnreplaced.map(x => x.name).join(", ")}</p></div>}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            className={`chip ${tab === t ? "chip-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" && <><AccountNoticeCenter trainer /><ActiveMilestones days={s.activeDays} role="trainer" />{!credentialsPaused && <Overview />}</>}
      {tab === "My Profile" && <TrainerProfileTab />}
      {tab === "Calendar" && !credentialsPaused && (
        <>
          <CalendarTab />
          <MemberSessions trainer />
          <ClassManager />
          <RecordingManager />
        </>
      )}
      {tab === "On-demand" && !credentialsPaused && (
        <>
          <Uploads />
          <TrainerProgramManager />
        </>
      )}
      {tab === "Store" && <StoreTab />}
      {credentialsPaused && (tab === "Calendar" || tab === "On-demand") && <p className="card p-6" role="alert">New uploads and live hosting are paused until expired required credentials are renewed and verified. Go to Credentials to submit updated proof.</p>}
      {tab === "Credentials" && (
        <div className="card space-y-6 p-6">
          <RolePicker />
          <CertManager />
          <p className="text-xs text-muted-foreground">
            Finished a new course? Add it here — we review it and it shows on
            your profile once verified.
          </p>
        </div>
      )}
    </div>
  );
}

function NutritionOverview() {
  const { s } = useStore();
  const stats = [
    ["1-on-1 consults (month)", String(s.bookings.length)],
    ["Rate per session", `$${s.extra.trainer.rate}`],
    ["Certifications", String(s.extra.trainer.certs.length)],
    ["Specialties", String(s.extra.trainer.specialties.length)],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="card p-5 text-sm text-muted-foreground">
        Your nutrition business runs on 1-on-1 consults. When a client books
        you, their meal plan appears under Client menus so you can shape it.
        Want to teach live classes too? Add "Trainer" under the Credentials tab.
      </div>
    </div>
  );
}

function Overview() {
  const { s, set, uid } = useStore();
  const me = useUserId();
  const [f, setF] = useState({
    title: "",
    category: "Strength",
    level: "Beginner",
    when: "",
    description: "",
  });
  const [live, setLive] = useState(false);
  const [approvedCount, setApprovedCount] = useState(0);
  const [cprApproved, setCprApproved] = useState(false);
  const [countLoaded, setCountLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const result = await supabase
        .from("trainer_videos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .eq("review_status", "approved");
      const certs = await supabase
        .from("certifications")
        .select("name,status,expires,verified_at,verified_by")
        .eq("user_id", data.user.id);
      if (active) {
        setApprovedCount(result.error ? 0 : (result.count ?? 0));
        setCprApproved(
          !certs.error &&
            hasVerifiedCpr((certs.data ?? []) as CredentialRecord[]),
        );
        setCountLoaded(!result.error && !certs.error);
      }
    });
    return () => {
      active = false;
    };
  }, [s.signedIn, s.extra.trainer.videos.length]);
  const unlocked = countLoaded && approvedCount >= UNLOCK && cprApproved;
  const [st, setSt] = useState<Awaited<
    ReturnType<typeof getPayoutStatus>
  > | null>(null);
  useEffect(() => {
    getPayoutStatus()
      .then(setSt)
      .catch(() => setSt(null));
  }, []);
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const livesHeld = st?.stats.liveClassesMonth ?? 0;
  const att = st?.stats.liveAttendanceMonth ?? 0;
  const analytics = [
    ["Live attendance (30 days)", st ? String(att) : "—"],
    [
      "Avg per live",
      st ? (livesHeld ? String(Math.round(att / livesHeld)) : "0") : "—",
    ],
    ["Ad revenue share", st ? money(st.bySource.ads) : "—"],
    ["1-on-1 earnings", st ? money(st.bySource.oneonone) : "—"],
    ["1-on-1 sessions", st ? String(st.stats.oneononeSessions) : "—"],
    ["Followers", st ? String(st.stats.followers) : "—"],
    ["Trybe members", st ? String(st.stats.trybeMembers) : "—"],
    ["Approved on-demand videos", countLoaded ? String(approvedCount) : "…"],
  ];
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {analytics.map(([l, v]) => (
          <div key={l} className="card p-5">
            <p className="font-display text-3xl font-bold">{v}</p>
            <p className="text-sm text-muted-foreground">{l}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Payouts />
        <section className="card space-y-3 p-6">
          <h2 className="text-xl font-bold">Schedule a live class</h2>
          {!unlocked ? (
            <div className="rounded-xl bg-secondary p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4" />
                Lives unlock after {UNLOCK} approved on-demand videos and
                verified, current CPR/AED
              </p>
              <div className="mt-2 h-2 rounded-full bg-background">
                <div
                  className="h-2 rounded-full bg-brand"
                  style={{
                    width: `${Math.min(100, (approvedCount / UNLOCK) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-muted-foreground">
                Approved videos: {countLoaded ? approvedCount : "Checking…"}/
                {UNLOCK} · CPR/AED: {cprApproved ? "Verified" : "Required"}
              </p>
            </div>
          ) : (
            <>
              <input
                className="field"
                placeholder="Class title"
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="field"
                  value={f.category}
                  onChange={(e) => setF({ ...f, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <select
                  className="field"
                  value={f.level}
                  onChange={(e) => setF({ ...f, level: e.target.value })}
                >
                  {[
                    "Beginner",
                    "Intermediate",
                    "Advanced",
                    "Postpartum",
                    "All levels",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <input
                type="datetime-local"
                className="field"
                value={f.when}
                onChange={(e) => setF({ ...f, when: e.target.value })}
              />
              <textarea
                className="field"
                placeholder="Description"
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
              <button
                className="btn btn-primary w-full"
                disabled={!f.title || !f.when || !unlocked}
                onClick={async () => {
                  if (!me || !unlocked) {
                    toast.error(
                      "Five approved videos and verified CPR are required to schedule.",
                    );
                    return;
                  }
                  const when = new Date(f.when);
                  if (
                    Number.isNaN(when.getTime()) ||
                    when.getTime() <= Date.now()
                  ) {
                    toast.error("Choose a future class time.");
                    return;
                  }
                  const { error } = await supabase
                    .from("live_sessions")
                    .insert({
                      trainer_id: me,
                      trainer_name: s.name,
                      title: f.title,
                      category: f.category,
                      level: f.level,
                      starts_at: when.toISOString(),
                      description: f.description,
                    });
                  if (error) {
                    toast.error(
                      "Couldn't schedule this class. Please try again.",
                    );
                    return;
                  }
                  set((x) => ({
                    ...x,
                    scheduled: [...x.scheduled, { ...f, id: uid() }],
                    extra: {
                      ...x.extra,
                      trainer: {
                        ...x.extra.trainer,
                        blocks: [
                          ...x.extra.trainer.blocks,
                          {
                            id: uid(),
                            date: f.when.slice(0, 10),
                            label: `Live: ${f.title}`,
                            kind: "live",
                            time: f.when.slice(11, 16) || undefined,
                          },
                        ],
                      },
                    },
                  }));
                  void supabase.from("posts").insert({
                    author_id: me,
                    author_name: s.name,
                    trybe: `coach-${me}`,
                    kind: "New live",
                    text: `New live class: ${f.title} · ${when.toLocaleString()}${f.description ? ` — ${f.description}` : ""}`,
                  });
                  setF({
                    title: "",
                    category: "Strength",
                    level: "Beginner",
                    when: "",
                    description: "",
                  });
                  toast.success("Class scheduled");
                }}
              >
                Schedule
              </button>
              <button
                className={`btn w-full ${live ? "btn-outline" : "btn-ghost"}`}
                onClick={() => setLive(!live)}
              >
                {live ? "End broadcast" : "Go live now"}
              </button>
            </>
          )}
        </section>
      </div>
      {live && me && (
        <HostRoom me={me} name={s.name} onLeave={() => setLive(false)} />
      )}
      <p className="text-sm text-muted-foreground">
        Moderate your Trybe (pin and remove posts) on the{" "}
        <Link to="/trybes" className="text-primary">
          Trybes
        </Link>{" "}
        page, and reply to reviews on your profile.
      </p>
    </div>
  );
}

function Payouts() {
  const [st, setSt] = useState<Awaited<
    ReturnType<typeof getPayoutStatus>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    getPayoutStatus()
      .then(setSt)
      .catch(() => setUnavailable(true));
    const p = new URLSearchParams(window.location.search).get("payouts");
    if (p === "done")
      toast.success("Bank details saved — we're confirming them with Stripe.");
  }, []);
  if (unavailable)
    return (
      <section className="card p-6">
        <h2 className="text-xl font-bold">Earnings &amp; payouts</h2>
        <p className="text-sm text-muted-foreground">
          Your verified earnings could not be loaded. Please try again later.
        </p>
      </section>
    );
  if (!st) return <p className="card p-6">Loading verified earnings…</p>;
  const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
  return (
    <section className="card p-6">
      <h2 className="text-xl font-bold">Earnings &amp; payouts</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        All payouts are after card processing fees: 90% of 1-on-1s, 50% of
        live-class tokens, 50% of ad revenue.
      </p>
      <div className="mt-4 divide-y text-sm">
        {(
          [
            ["1-on-1 sessions (90%)", st?.bySource.oneonone ?? 0],
            ["Live tokens (50%)", st?.bySource.live ?? 0],
            ["On-demand ads (50%)", st?.bySource.ads ?? 0],
          ] as const
        ).map(([l, c]) => (
          <div key={l} className="flex justify-between py-3">
            <span>{l}</span>
            <span>{$(c)}</span>
          </div>
        ))}
        <div className="flex justify-between py-3 text-muted-foreground">
          <span>Processing fees deducted (before split)</span>
          <span>{$(st?.fees ?? 0)}</span>
        </div>
        <div className="flex justify-between py-3 font-bold">
          <span>Waiting to be paid</span>
          <span className="text-primary">{$(st?.pending ?? 0)}</span>
        </div>
        <div className="flex justify-between py-3">
          <span>Paid to your bank</span>
          <span>{$(st?.paid ?? 0)}</span>
        </div>
      </div>
      {st?.enabled ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-primary">
          <ShieldCheck className="h-4 w-4" />
          Bank linked — earnings are transferred in a payout run.
        </p>
      ) : (
        <button
          className="btn btn-primary mt-2"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await startPayoutOnboarding();
              if (r.url) window.location.href = r.url;
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Couldn't start payout setup",
              );
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Opening…"
            : st?.linked
              ? "Finish bank setup"
              : "Link your bank for payouts"}
        </button>
      )}
    </section>
  );
}

const toSecs = parseBreaks;

function CalendarTab() {
  const { s, setExtra, uid } = useStore();
  const me = useUserId();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("ALL");
  const [booked, setBooked] = useState<BusyRow[]>([]);
  const blocks = s.extra.trainer.blocks;
  // Whatever is blocked here is what the 1-on-1 booking widget on your profile refuses to sell.
  const publish = (day: string, time: string, source: string) => {
    if (me)
      void supabase
        .from("trainer_busy")
        .upsert({ trainer_id: me, day, time, source })
        .then(() => {});
  };
  const unpublish = (day: string, time: string) => {
    if (me)
      void supabase
        .from("trainer_busy")
        .delete()
        .eq("trainer_id", me)
        .eq("day", day)
        .eq("time", time)
        .then(() => {});
  };
  const loadBooked = () => {
    if (me)
      void supabase
        .from("trainer_busy")
        .select("day, time, source")
        .eq("trainer_id", me)
        .eq("source", "booked")
        .then(({ data }) => setBooked((data ?? []) as BusyRow[]));
  };
  useEffect(() => {
    if (!me) return;
    blocks.forEach((b) =>
      publish(b.date, b.time ?? "ALL", b.kind === "live" ? "live" : "personal"),
    );
    loadBooked();
  }, [me]);
  const oneOnOnes = booked.map((b) => ({
    id: `${b.day}-${b.time}`,
    date: b.day,
    label: b.time === "ALL" ? "1-on-1 booked" : `1-on-1 ${b.time}`,
    kind: "oneonone" as const,
  }));
  const all = [...blocks, ...oneOnOnes];
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = month.getDay();
  const iso = (d: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const color = {
    live: "bg-primary/20 text-primary",
    oneonone: "bg-accent/20 text-accent",
    personal: "bg-secondary text-muted-foreground",
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-ghost"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ←
        </button>
        <p className="font-display text-xl font-bold">
          {month.toLocaleString("en-US", { month: "long", year: "numeric" })}
        </p>
        <button
          className="btn btn-ghost"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          →
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            type="date"
            className="field w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <select
            className="field w-auto"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            aria-label="Time to block"
          >
            <option value="ALL">All day</option>
            {TRAINING_TIMES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <input
            className="field w-auto"
            placeholder="Personal time (e.g. School pickup)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!date}
            onClick={() => {
              const time = slot;
              setExtra((x) => ({
                ...x,
                trainer: {
                  ...x.trainer,
                  blocks: [
                    ...x.trainer.blocks,
                    {
                      id: uid(),
                      date,
                      label: `${label || "Unavailable"}${time === "ALL" ? "" : ` ${time}`}`,
                      kind: "personal",
                      time: time === "ALL" ? undefined : time,
                    },
                  ],
                },
              }));
              publish(date, time, "personal");
              setLabel("");
              toast.success("Blocked — clients can't book 1-on-1s then");
            }}
          >
            Block time
          </button>
          <button className="btn btn-ghost" onClick={loadBooked}>
            Refresh
          </button>
        </div>
      </div>
      <div className="flex gap-3 text-xs">
        <span className={`rounded px-2 py-0.5 ${color.live}`}>Live class</span>
        <span className={`rounded px-2 py-0.5 ${color.oneonone}`}>
          1-on-1 booked by a client
        </span>
        <span className={`rounded px-2 py-0.5 ${color.personal}`}>
          Personal / blocked
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Booked 1-on-1s and blocked time both come from your cloud calendar, so a
        client can't pay for a slot you've already taken.
      </p>
      {me &&
        booked.filter(
          (b) =>
            b.time !== "ALL" && b.day >= new Date().toISOString().slice(0, 10),
        ).length > 0 && (
          <div className="card space-y-2 p-4">
            <p className="font-semibold">Upcoming 1-on-1 sessions</p>
            {booked
              .filter(
                (b) =>
                  b.time !== "ALL" &&
                  b.day >= new Date().toISOString().slice(0, 10),
              )
              .sort((a, b) =>
                `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`),
              )
              .map((b) => (
                <div
                  key={`${b.day}-${b.time}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    {b.day} at {b.time}
                  </span>
                  <SessionJoinButton
                    trainerId={me}
                    date={b.day}
                    time={b.time}
                    title="1-on-1 session"
                    hostName={s.name}
                    isTrainer
                  />
                </div>
              ))}
          </div>
        )}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <p key={d} className="p-1 text-center text-muted-foreground">
            {d}
          </p>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <div key={`l${i}`} />
        ))}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1;
          const items = all.filter((b) => b.date === iso(d));
          return (
            <div key={d} className="card min-h-20 p-1.5">
              <p className="font-semibold">{d}</p>
              {items.map((b) => (
                <button
                  key={b.id}
                  title={
                    b.kind === "oneonone"
                      ? "Booked by a client — remove it from the client's side"
                      : "Click to remove"
                  }
                  onClick={() => {
                    if (b.kind === "oneonone") return;
                    const blk = blocks.find((y) => y.id === b.id);
                    setExtra((x) => ({
                      ...x,
                      trainer: {
                        ...x.trainer,
                        blocks: x.trainer.blocks.filter((y) => y.id !== b.id),
                      },
                    }));
                    unpublish(b.date, blk?.time ?? "ALL");
                  }}
                  className={`mt-1 block w-full truncate rounded px-1 text-left ${color[b.kind]}`}
                >
                  {b.label}
                </button>
              ))}
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
  const [f, setF] = useState({
    title: "",
    description: "",
    spotify: "",
    category: "Strength",
    level: "Beginner",
    minutes: "20",
    breaks: "",
    gear: [] as string[],
    optionalGear: [] as string[],
    friendly: [] as string[],
    goals: [] as string[],
    pregnancySafe: false,
    playlist: "",
    newPl: "",
    breakSecs: 15,
  });
  const myPlaylists = [
    ...new Set(
      s.extra.trainer.videos.map((v) => v.playlist).filter(Boolean) as string[],
    ),
  ];
  const breakErr = validateBreaks(toSecs(f.breaks), +f.minutes || 0);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const vids = s.extra.trainer.videos.filter(isLaunchWorkout);
  useEffect(() => {
    if (!me) return;
    supabase
      .from("trainer_videos")
      .select(
        "id,title,category,level,minutes,path,equipment,pregnancy_safe,playlist,review_status,review_note",
      )
      .eq("user_id", me)
      .then(({ data, error }) => {
        if (error || !data) return;
        setExtra((x) => ({
          ...x,
          trainer: {
            ...x.trainer,
            videos: data.map((v) => ({
              ...v,
              pregnancySafe: v.pregnancy_safe,
              reviewStatus: v.review_status,
              reviewNote: v.review_note,
              goals: goalsOf(v),
            })),
          },
        }));
      });
  }, [me]);
  const youth = useYouthStatus().status;
  const youthLocked = youth === "pending" || youth === "rejected";
  const publish = async () => {
    if (!me || !file) return;
    if (
      !Number.isInteger(Number(f.minutes)) ||
      Number(f.minutes) < 1 ||
      Number(f.minutes) > 300
    ) {
      toast.error("Enter a duration from 1 to 300 minutes");
      return;
    }
    if (
      f.spotify &&
      !/^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/.test(
        f.spotify,
      )
    ) {
      toast.error("Use a Spotify playlist link");
      return;
    }
    if (youthLocked) {
      toast.error(
        "Uploads open once the Tryumph team approves your guardian consent.",
      );
      return;
    }
    if (breakErr) {
      toast.error(breakErr);
      return;
    }
    const playlist = (f.playlist === "__new" ? f.newPl : f.playlist).trim();
    const MAX = 3 * 1024 * 1024 * 1024;
    if (file.size > MAX) {
      toast.error(
        `That file is ${(file.size / 1024 / 1024 / 1024).toFixed(1)} GB — the limit is 3 GB. Re-record in 720p or trim it.`,
      );
      return;
    }
    setBusy(true);
    setProgress(0);
    let path = "";
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token)
        throw new Error("Please sign in again before uploading");
      const ticketResponse = await fetch("/api/bunny-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ title: f.title }),
      });
      const ticket = (await ticketResponse.json()) as {
        error?: string;
        videoId?: string;
        libraryId?: string;
        signature?: string;
        expires?: number;
      };
      if (
        !ticketResponse.ok ||
        !ticket.videoId ||
        !ticket.libraryId ||
        !ticket.signature ||
        !ticket.expires
      )
        throw new Error(ticket.error || "Could not start Bunny upload");
      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: "https://video.bunnycdn.com/tusupload",
          retryDelays: [0, 1000, 3000, 5000, 10000],
          chunkSize: 8 * 1024 * 1024,
          headers: {
            AuthorizationSignature: ticket.signature!,
            AuthorizationExpire: String(ticket.expires),
            VideoId: ticket.videoId!,
            LibraryId: ticket.libraryId!,
          },
          metadata: { filetype: file.type || "video/mp4", title: file.name },
          onProgress: (sent, total) =>
            setProgress(Math.round((sent / total) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        });
        upload.start();
      });
      path = `bunny:${ticket.libraryId}:${ticket.videoId}`;
    } catch (error) {
      setBusy(false);
      toast.error(
        error instanceof Error ? error.message : "Video upload failed",
      );
      return;
    }
    const requiredEquipment = f.gear.filter((g) => !f.optionalGear.includes(g));
    const optionalEquipment = f.gear.filter((g) => f.optionalGear.includes(g));
    const equipment = encodeEquipment(requiredEquipment, f.friendly, f.goals);
    const ins = await supabase
      .from("trainer_videos")
      .insert({
        user_id: me,
        title: f.title,
        description: f.description,
        spotify_url: f.spotify || null,
        category: f.category,
        level: f.level,
        path,
        minutes: +f.minutes || 0,
        breaks: toSecs(f.breaks),
        equipment,
        pregnancy_safe: f.pregnancySafe,
        playlist,
        break_seconds: f.breakSecs,
        required_equipment: requiredEquipment,
        optional_equipment: optionalEquipment,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      setBusy(false);
      toast.error(
        `Video uploaded to Bunny, but publishing failed: ${ins.error?.message || "database error"}. Contact support before retrying to avoid duplicate uploads.`,
      );
      return;
    }
    const id = ins.data.id;
    setExtra((x) => ({
      ...x,
      trainer: {
        ...x.trainer,
        videos: [
          ...x.trainer.videos,
          {
            id,
            title: f.title,
            category: f.category,
            level: f.level,
            minutes: +f.minutes || 0,
            path,
            equipment,
            goals: f.goals,
            pregnancySafe: f.pregnancySafe,
            playlist,
          },
        ],
      },
    }));
    setF({
      ...f,
      title: "",
      description: "",
      spotify: "",
      breaks: "",
      newPl: "",
      goals: [],
      optionalGear: [],
      gear: [],
      playlist,
    });
    setFile(null);
    setBusy(false);
    toast.success(
      "Video uploaded for review — it will appear publicly after approval.",
    );
  };
  const assignPlaylist = async (video: TrainerVideo, playlist: string) => {
    if (!me) return;
    const { error } = await supabase
      .from("trainer_videos")
      .update({ playlist })
      .eq("id", video.id)
      .eq("user_id", me);
    if (error) {
      toast.error(`Could not update playlist: ${error.message}`);
      return;
    }
    setExtra((x) => ({
      ...x,
      trainer: {
        ...x.trainer,
        videos: x.trainer.videos.map((v) =>
          v.id === video.id ? { ...v, playlist } : v,
        ),
      },
    }));
    toast.success("Playlist updated");
  };
  const renamePlaylist = async (oldName: string, newName: string) => {
    if (!me || !newName.trim() || oldName === newName.trim()) return;
    setPlaylistBusy(true);
    const { error } = await supabase
      .from("trainer_videos")
      .update({ playlist: newName.trim() })
      .eq("user_id", me)
      .eq("playlist", oldName);
    setPlaylistBusy(false);
    if (error) {
      toast.error(`Could not rename playlist: ${error.message}`);
      return;
    }
    setExtra((x) => ({
      ...x,
      trainer: {
        ...x.trainer,
        videos: x.trainer.videos.map((v) =>
          v.playlist === oldName ? { ...v, playlist: newName.trim() } : v,
        ),
      },
    }));
    toast.success("Playlist renamed");
  };
  const drop = async (v: TrainerVideo) => {
    if (!me) return;
    let ids: string[] = [];
    let obj = v.path;
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        v.id,
      )
    ) {
      const { data } = await supabase
        .from("trainer_videos")
        .select("id, path")
        .eq("id", v.id)
        .maybeSingle();
      if (data) {
        ids = [data.id];
        obj = obj ?? data.path;
      }
    }
    if (!ids.length) {
      const { data } = await supabase
        .from("trainer_videos")
        .select("id, path")
        .eq("user_id", me)
        .eq("title", v.title);
      ids = (data ?? []).map((r) => r.id);
      obj = obj ?? data?.[0]?.path;
    }
    if (ids.length) {
      const { error } = await supabase
        .from("trainer_videos")
        .delete()
        .eq("user_id", me)
        .in("id", ids);
      if (error) {
        toast.error(`Could not delete video: ${error.message}`);
        return;
      }
    }
    if (obj && !obj.startsWith("bunny:"))
      await supabase.storage.from("videos").remove([obj]);
    setExtra((x) => ({
      ...x,
      trainer: {
        ...x.trainer,
        videos: x.trainer.videos.filter((y) => y.id !== v.id),
      },
    }));
    toast.success("Video removed from your library");
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-3 p-6">
        <h2 className="text-xl font-bold">Upload an on-demand workout</h2>
        <p className="text-sm text-muted-foreground">
          {vids.length >= UNLOCK
            ? "Live classes unlocked 🎉"
            : `${UNLOCK - vids.length} more to unlock live classes.`}
        </p>
        {youthLocked && (
          <p className="rounded-lg bg-secondary p-3 text-sm text-warning">
            Youth Ambassador uploads are locked until the Tryumph team approves
            your parent/guardian consent.
          </p>
        )}
        <input
          type="file"
          accept="video/*"
          className="field"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {busy && (
          <p role="status" className="text-sm text-primary">
            Uploading to Bunny: {progress}%
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Max 3 GB. A 45-minute class in 720p lands near 1 GB; in 1080p it runs
          2–3 GB. Phone recordings are usually fine.
        </p>
        <input
          className="field"
          placeholder="Title"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
        <textarea
          className="field"
          placeholder="Workout description"
          maxLength={4000}
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        <input
          className="field"
          type="url"
          placeholder="Spotify playlist link (optional)"
          value={f.spotify}
          onChange={(e) => setF({ ...f, spotify: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-3">
          <select
            className="field"
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            className="field"
            value={f.level}
            onChange={(e) => setF({ ...f, level: e.target.value })}
          >
            {["Beginner", "Intermediate", "Advanced", "Postpartum"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            className="field"
            value={f.minutes}
            onChange={(e) => setF({ ...f, minutes: e.target.value })}
            placeholder="min"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <MultiDropdown
              label="Fitness goals"
              values={f.goals}
              options={FITNESS_GOALS}
              emptyLabel="Choose goals"
              onChange={(goals) => setF({ ...f, goals })}
            />
          </div>
          <div className="col-span-2 text-sm font-medium">
            Equipment used
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              Select all equipment used. Each selected item can be required or
              optional. No equipment selected means bodyweight/no equipment
              required.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EQUIPMENT.filter((c) => c !== "No equipment").map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${f.gear.includes(c) ? "chip-active" : ""}`}
                  onClick={() =>
                    setF({
                      ...f,
                      gear: f.gear.includes(c)
                        ? f.gear.filter((y) => y !== c)
                        : [...f.gear, c],
                      optionalGear: f.optionalGear.filter((y) => y !== c),
                    })
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            {f.gear.map((c) => (
              <div
                key={c}
                className="mt-2 flex items-center justify-between gap-3 text-sm"
              >
                <span>{c}</span>
                <select
                  className="field max-w-36"
                  aria-label={`${c} requirement`}
                  value={f.optionalGear.includes(c) ? "optional" : "required"}
                  onChange={(e) =>
                    setF({
                      ...f,
                      optionalGear:
                        e.target.value === "optional"
                          ? [...f.optionalGear, c]
                          : f.optionalGear.filter((y) => y !== c),
                    })
                  }
                >
                  <option value="required">Required</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
            ))}
            {f.gear.length > 0 &&
              f.gear.every((g) => f.optionalGear.includes(g)) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No equipment required — all selected equipment is optional.
                </p>
              )}
          </div>
          <div className="col-span-2 text-sm font-medium">
            Good for
            <div className="mt-1 flex flex-wrap gap-2">
              {FRIENDLY.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${f.friendly.includes(c) ? "chip-active" : ""}`}
                  onClick={() =>
                    setF({
                      ...f,
                      friendly: f.friendly.includes(c)
                        ? f.friendly.filter((y) => y !== c)
                        : [...f.friendly, c],
                    })
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm font-medium">
            Playlist
            <select
              className="field mt-1"
              value={f.playlist}
              onChange={(e) => setF({ ...f, playlist: e.target.value })}
            >
              <option value="">None</option>
              {myPlaylists.map((p) => (
                <option key={p}>{p}</option>
              ))}
              <option value="__new">+ New playlist</option>
            </select>
          </label>
        </div>
        {f.playlist === "__new" && (
          <input
            className="field"
            placeholder="New playlist name"
            value={f.newPl}
            onChange={(e) => setF({ ...f, newPl: e.target.value })}
          />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={f.pregnancySafe}
            onChange={(e) => setF({ ...f, pregnancySafe: e.target.checked })}
          />
          Pregnancy safe
        </label>
        <label className="block text-sm font-medium">
          Rest / water breaks
          <input
            className="field mt-1"
            placeholder="e.g. 12:30, 25:00, 38:15"
            value={f.breaks}
            onChange={(e) => setF({ ...f, breaks: e.target.value })}
          />
        </label>
        <div className="flex items-center gap-2 text-sm">
          Break length{" "}
          {BREAK_LENGTHS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${f.breakSecs === n ? "chip-active" : ""}`}
              onClick={() => setF({ ...f, breakSecs: n })}
            >
              {n}s
            </button>
          ))}
        </div>
        {breakErr && f.breaks && (
          <p className="text-sm text-destructive">{breakErr}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Rules: no breaks in the first 3 or last 2 minutes, and at least 5
          minutes apart. Ads only ever play at the moments you mark here — never
          mid-set. Leave blank for an Ad-Free video: no ads will play and no ad
          revenue share is earned from that video. When ads run at your marked
          water breaks, your 50% share is calculated after payment-processing
          fees.
        </p>
        <button
          className="btn btn-primary w-full"
          disabled={!f.title || !file || busy || (!!f.breaks && !!breakErr)}
          onClick={publish}
        >
          {busy ? "Uploading…" : "Upload for review"}
        </button>
      </section>
      <section className="card p-6">
        <h2 className="text-xl font-bold">Your library ({vids.length})</h2>
        <div className="mt-4 rounded-lg border p-3 space-y-2">
          <h3 className="font-semibold">Organize workout playlists</h3>
          <p className="text-xs text-muted-foreground">
            Create a playlist by entering a name below, then assign your
            existing workouts. You can change a workout's playlist without
            re-uploading it.
          </p>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              placeholder="Playlist name (e.g. 4-Week Beginner Strength)"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                if (playlistName.trim()) {
                  setF((old) => ({
                    ...old,
                    playlist: "__new",
                    newPl: playlistName.trim(),
                  }));
                  toast(
                    "Playlist name prepared for your next upload. You can also assign this name below.",
                  );
                }
              }}
            >
              Use for next upload
            </button>
          </div>
          {myPlaylists.map((name) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate">
                {name} ({vids.filter((v) => v.playlist === name).length})
              </span>
              <button
                className="text-primary underline"
                disabled={playlistBusy}
                onClick={() => {
                  const next = window.prompt("Rename playlist", name);
                  if (next) void renamePlaylist(name, next);
                }}
              >
                Rename
              </button>
            </div>
          ))}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {vids.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2"
            >
              <span>
                {v.title}
                <label className="mt-1 block text-xs">
                  Playlist{" "}
                  <select
                    className="field mt-1 max-w-56"
                    value={v.playlist ?? ""}
                    onChange={(e) => void assignPlaylist(v, e.target.value)}
                  >
                    <option value="">None</option>
                    {[
                      ...new Set(
                        [...myPlaylists, playlistName.trim()].filter(Boolean),
                      ),
                    ].map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {goalsOf(v).length > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {goalsOf(v).join(" · ")}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {v.category} · {v.level} · {v.minutes}m
                <button className="text-destructive" onClick={() => drop(v)}>
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TrainerProfileTab() {
  const { s, setExtra, set } = useStore();
  const trainer = s.extra.trainer;
  const update = (patch: Partial<typeof trainer>) =>
    setExtra((x) => ({ ...x, trainer: { ...x.trainer, ...patch } }));
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-xl font-bold">My Trainer Profile</h2>
      <p className="text-sm text-muted-foreground">
        To upload or change your profile photo, open{" "}
        <Link to="/account" className="text-primary underline">
          Account → Profile photo
        </Link>
        . The same photo is used for your coaching profile.
      </p>
      <p className="text-sm text-muted-foreground">
        Manage your coaching details in one place. Your member account remains
        available for taking classes.
      </p>
      <label className="block text-sm font-medium">
        Display name
        <input
          className="field mt-1 w-full"
          value={s.name}
          onChange={(e) => set((x) => ({ ...x, name: e.target.value }))}
        />
      </label>
      <label className="block text-sm font-medium">
        Trainer bio
        <textarea
          className="field mt-1 w-full"
          rows={5}
          maxLength={2000}
          placeholder="Introduce yourself, your approach and who you help"
          value={trainer.bio}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </label>
      <label className="block text-sm font-medium">
        Specialties (comma-separated)
        <input
          className="field mt-1 w-full"
          placeholder="Postpartum strength, low-impact fitness"
          value={trainer.specialties.join(", ")}
          onChange={(e) =>
            update({
              specialties: e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className="block text-sm font-medium">
        Website
        <input
          className="field mt-1 w-full"
          type="url"
          placeholder="https://yourwebsite.com"
          value={trainer.website ?? ""}
          onChange={(e) => update({ website: e.target.value })}
        />
      </label>
      <label className="block text-sm font-medium">
        Instagram profile
        <input
          className="field mt-1 w-full"
          type="url"
          placeholder="https://instagram.com/yourhandle"
          value={trainer.instagram ?? ""}
          onChange={(e) => update({ instagram: e.target.value })}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Changes save with your account. Public trainer profile synchronization
        must be verified before inviting trainers.
      </p>
      <Link to="/trybes" className="btn btn-outline inline-flex">
        Manage My Trybe
      </Link>
    </section>
  );
}

function StoreTab() {
  return <TrainerStoreManager />;
}

const sampleClients: { name: string; note: string; plan: MealPlan }[] = [
  {
    name: "Jess R.",
    note: "Postpartum 14 weeks · 2 finger DR gap · low impact · breastfeeding",
    plan: {
      Mon: {
        Breakfast: [
          {
            id: "a",
            title: "Overnight Protein Oats",
            kcal: 380,
            protein: 28,
            carbs: 48,
            fat: 9,
          },
        ],
      },
    },
  },
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
        <span className="flex-1">
          Clients share their weekly menu with you using your code. Give it to
          them after booking.
        </span>
        <span className="chip chip-active font-mono text-base">
          {me ? shareCode(me) : "…"}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (me) {
              void navigator.clipboard.writeText(shareCode(me));
              toast.success("Code copied");
            }
          }}
        >
          Copy
        </button>
        <button className="btn btn-ghost" onClick={() => void reload()}>
          Refresh
        </button>
      </div>
      {clients.length === 0 ? (
        <p className="card p-8 text-center text-muted-foreground">
          No clients have shared a menu with you yet.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {clients.map((x) => (
              <button
                key={x.client_id}
                className={`chip ${cur?.client_id === x.client_id ? "chip-active" : ""}`}
                onClick={() => setSel(x.client_id)}
              >
                {x.client_name}
              </button>
            ))}
          </div>
          <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="flex-1">
              {menu?.approved_by
                ? `Approved by ${menu.approved_by}`
                : "Not approved yet"}
            </span>
            <label>
              Calories
              <input
                type="number"
                className="field ml-2 inline w-24"
                value={target.kcal}
                onChange={(e) =>
                  save({ target: { ...target, kcal: +e.target.value } })
                }
              />
            </label>
            <label>
              Protein
              <input
                type="number"
                className="field ml-2 inline w-20"
                value={target.protein}
                onChange={(e) =>
                  save({ target: { ...target, protein: +e.target.value } })
                }
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={() => {
                save({
                  approved_by: s.name,
                  approved_at: new Date().toISOString(),
                });
                toast.success(
                  `Plan marked Nutritionist Approved for ${cur!.client_name}`,
                );
              }}
            >
              Mark approved
            </button>
          </div>
          <MenuBoard
            plan={menu?.plan ?? {}}
            target={target}
            editor={s.name}
            onChange={(p) => save({ plan: p })}
          />
        </>
      )}
    </div>
  );
}

const LiveRoomLazy = lazy(() => import("@/components/LiveRoom"));
function HostRoom({
  me,
  name,
  onLeave,
}: {
  me: string;
  name: string;
  onLeave: () => void;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);
  useEffect(() => {
    // Trainers may enter only a real scheduled class; no unauthorized personal-room fallback.
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    supabase
      .from("live_sessions")
      .select("id")
      .eq("trainer_id", me)
      .gte("starts_at", recent)
      .lte("starts_at", soon)
      .order("starts_at")
      .limit(1)
      .then(({ data }) => setRoomId(data?.[0] ? `live-${data[0].id}` : "none"));
  }, [me]);
  if (!roomId)
    return (
      <div className="card grid aspect-video place-items-center">
        <p className="text-muted-foreground">Opening your scheduled room…</p>
      </div>
    );
  if (roomId === "none")
    return (
      <div className="card p-5">
        <p className="font-semibold">No class is starting right now.</p>
        <p className="text-sm text-muted-foreground">
          Schedule a class first, then open its room near the start time.
        </p>
        <button className="btn btn-outline mt-3" onClick={onLeave}>
          Close
        </button>
      </div>
    );
  return (
    <ClientOnly fallback={null}>
      <Suspense
        fallback={
          <div className="card grid aspect-video place-items-center">
            <p className="text-muted-foreground">Loading the room…</p>
          </div>
        }
      >
        <LiveRoomLazy
          roomId={roomId}
          title="Live class"
          hostName={name}
          onLeave={onLeave}
          isHost
        />
      </Suspense>
    </ClientOnly>
  );
}
