import { ClientOnly, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, Coins, Users } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { liveClasses, trainerById, type LiveClass } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { recordLiveAttendance } from "@/lib/payouts.functions";

const LiveRoom = lazy(() => import("@/components/LiveRoom"));

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Classes — Tryumph Gym" },
      { name: "description", content: "Reserve live classes to get reminders. One token is used only when you enter the room." },
      { property: "og:title", content: "Live Classes — Tryumph Gym" },
      { property: "og:description", content: "Uncapped live group classes for one token." },
    ],
  }),
  component: Live,
});

function Live() {
  const { s, reserve, joinRoom, setExtra, uid } = useStore();
  const navigate = useNavigate();
  const [room, setRoom] = useState<(LiveClass & { hostName?: string }) | null>(null);
  const [needTokens, setNeedTokens] = useState<LiveClass | null>(null);
  const join = (l: LiveClass) => {
    if (!s.signedIn) { toast("Sign in to join live classes.", { action: { label: "Sign in", onClick: () => navigate({ to: "/account" }) } }); return; }
    if (!s.joined.includes(l.id) && s.tokens < 1) { setNeedTokens(l); return; }
    const r = joinRoom(l.id, l.title);
    (r.ok ? toast.success : toast.error)(r.msg);
    if (r.ok) { setRoom(l); void recordLiveAttendance({ data: { liveId: l.id } }).catch(() => {}); }
  };
  const [coachLives, setCoachLives] = useState<(LiveClass & { hostName: string })[]>([]);
  useEffect(() => {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    supabase.from("live_sessions").select("*").gte("starts_at", since).order("starts_at").limit(50).then(({ data }) => {
      setCoachLives((data ?? []).map((r) => ({
        id: r.id, title: r.title, trainerId: r.trainer_id, hostName: r.trainer_name,
        category: r.category as LiveClass["category"], level: r.level, minutes: r.minutes, attendees: 0, description: r.description,
        when: new Date(r.starts_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      })));
    });
  }, []);
  const allLives: (LiveClass & { hostName?: string })[] = [...coachLives, ...liveClasses];
  if (room) return <Room live={room} onLeave={() => setRoom(null)} />;
  const modal = needTokens && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" onClick={() => setNeedTokens(null)}>
      <div role="dialog" aria-modal="true" className="card w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <Coins className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">Join this live class</h2>
        <p className="mt-2 text-muted-foreground">{needTokens.title} requires 1 token to join. Grab a token to hop in — no subscription, tokens never expire.</p>
        <div className="mt-6 grid gap-2">
          <button className="btn btn-primary" onClick={() => navigate({ to: "/wallet" })}>Get tokens</button>
          <button className="btn btn-ghost" onClick={() => setNeedTokens(null)}>Maybe later</button>
        </div>
      </div>
    </div>
  );
  return (
    <div>
      {modal}
      <PageHeader eyebrow="1 token per class" title="Live Classes" sub="Reserving adds the class to your reminders (an alert 10 minutes before it starts). Your token is only used when you tap Join Room." />
      {s.signedIn && s.extra.alerts.length > 0 && (
        <div className="card mb-6 p-5">
          <p className="eyebrow">Your reminders</p>
          <ul className="mt-2 space-y-1 text-sm">{s.extra.alerts.slice(0, 5).map((a) => <li key={a.id} className="flex justify-between gap-3"><span>🔔 {a.text}</span><span className="text-muted-foreground">{a.date}</span></li>)}</ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {allLives.map((l) => {
          const t = l.hostName ? { name: l.hostName, initials: l.hostName.slice(0, 2).toUpperCase() } : trainerById(l.trainerId);
          const reserved = s.reservations.includes(l.id);
          const paid = s.joined.includes(l.id);
          return (
            <div key={l.id} className="card flex flex-col p-6">
              <div className="flex items-center gap-3">
                <Avatar initials={t.initials} />
                <div><p className="font-semibold">{t.name}</p><p className="text-sm text-muted-foreground">{l.when} · {l.minutes} min</p></div>
                <span className="chip ml-auto">{l.category}</span>
              </div>
              <h3 className="mt-4 text-xl font-bold">{l.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{l.description}</p>
              <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" />{l.attendees + (reserved ? 1 : 0)} reserved · {l.level} · no cap</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn btn-ghost" onClick={() => {
                  if (!s.signedIn) { toast.error("Sign in to reserve and get reminders."); return; }
                  reserve(l.id);
                  if (!reserved) {
                    setExtra((e) => ({ ...e, alerts: [{ id: uid(), text: `Reminders set for ${l.title}: 10 minutes before.`, date: l.when }, ...e.alerts].slice(0, 20) }));
                    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
                  }
                  toast(reserved ? "Reservation removed" : "Reserved! We'll remind you 10 minutes before.");
                }}>
                  {reserved ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4" />}{reserved ? "Reserved" : "Reserve"}
                </button>
                <button className="btn btn-primary" onClick={() => join(l)}>{paid ? "Rejoin room" : "Join Room · 1 token"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Room({ live, onLeave }: { live: LiveClass & { hostName?: string }; onLeave: () => void }) {
  const t = live.hostName ? { name: live.hostName } : trainerById(live.trainerId);
  return (
    <ClientOnly fallback={<div className="card grid aspect-video place-items-center"><p className="text-muted-foreground">Loading the room…</p></div>}>
      <Suspense fallback={<div className="card grid aspect-video place-items-center"><p className="text-muted-foreground">Loading the room…</p></div>}>
        <LiveRoom roomId={`live-${live.id}`} title={live.title} hostName={t.name} onLeave={onLeave} />
      </Suspense>
    </ClientOnly>
  );
}
