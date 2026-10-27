import {
  ClientOnly,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { Bell, BellRing, Coins, Users } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type LiveClass } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import {
  createLiveClassCheckout,
  redeemLiveClassToken,
} from "@/lib/live-booking.functions";

const LiveRoom = lazy(() => import("@/components/LiveRoom"));

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Classes — Tryumph Gym" },
      {
        name: "description",
        content:
          "Reserve live classes to get reminders. Book a $5 drop-in to join a live class.",
      },
      { property: "og:title", content: "Live Classes — Tryumph Gym" },
      {
        property: "og:description",
        content: "Live online group workouts with verified trainers.",
      },
    ],
  }),
  component: Live,
});

function Live() {
  const { s, reserve } = useStore();
  const navigate = useNavigate();
  const [room, setRoom] = useState<(LiveClass & { hostName?: string }) | null>(
    null,
  );
  const [needTokens, setNeedTokens] = useState<LiveClass | null>(null);
  const [access, setAccess] = useState<Set<string>>(new Set());
  const [busyCheckout, setBusyCheckout] = useState<string | null>(null);
  useEffect(() => {
    if (!s.signedIn) return;
    void supabase
      .from("live_room_access")
      .select("session_id")
      .eq("status", "paid")
      .then(({ data }) =>
        setAccess(new Set((data ?? []).map((row) => row.session_id))),
      );
  }, [s.signedIn]);
  const join = async (l: LiveClass) => {
    if (!s.signedIn) {
      toast.error("Sign in to join live classes.");
      navigate({ to: "/account" });
      return;
    }
    if (busyCheckout) return;
    // Access is checked again on the server before LiveKit issues a token.
    const { data: auth } = await supabase.auth.getUser();
    if (access.has(l.id) || (auth.user && l.trainerId === auth.user.id)) {
      setRoom(l);
      return;
    }
    try {
      setBusyCheckout(l.id);
      if (s.tokens > 0) {
        await redeemLiveClassToken({ data: { sessionId: l.id } });
        setAccess((old) => new Set(old).add(l.id));
        setRoom(l);
        return;
      }
      const result = await createLiveClassCheckout({
        data: { sessionId: l.id },
      });
      if (result.alreadyBooked) {
        setAccess((old) => new Set(old).add(l.id));
        setRoom(l);
        return;
      }
      if (!result.url) throw new Error("Checkout unavailable");
      window.location.assign(result.url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to book this class",
      );
    } finally {
      setBusyCheckout(null);
    }
  };
  const [coachLives, setCoachLives] = useState<
    (LiveClass & { hostName: string })[]
  >([]);
  useEffect(() => {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    supabase
      .from("live_sessions")
      .select("*")
      .in("status", ["scheduled", "live"])
      .gte("starts_at", since)
      .order("starts_at")
      .limit(50)
      .then(({ data }) => {
        setCoachLives(
          (data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            trainerId: r.trainer_id,
            hostName: r.trainer_name,
            category: r.category as LiveClass["category"],
            level: r.level,
            minutes: r.minutes,
            attendees: 0,
            description: r.description,
            when: new Date(r.starts_at).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            }),
          })),
        );
      });
  }, []);
  const allLives: (LiveClass & { hostName?: string })[] = coachLives;
  if (room) return <Room live={room} onLeave={() => setRoom(null)} />;
  const modal = needTokens && (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4"
      onClick={() => setNeedTokens(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="card w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Coins className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-2xl font-bold">Join this live class</h2>
        <p className="mt-2 text-muted-foreground">
          {needTokens.title} requires 1 token to join. Grab a token to hop in —
          no subscription, tokens never expire.
        </p>
        <div className="mt-6 grid gap-2">
          <button
            className="btn btn-primary"
            onClick={() => navigate({ to: "/wallet" })}
          >
            Get tokens
          </button>
          <button className="btn btn-ghost" onClick={() => setNeedTokens(null)}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <div>
      {modal}
      <PageHeader
        eyebrow="$5 per live class"
        title="Live Classes"
        sub="Reserve a reminder for free, or book your class for $5. Payment is verified before joining the room."
      />
      {s.signedIn && s.extra.alerts.length > 0 && (
        <div className="card mb-6 p-5">
          <p className="eyebrow">Your reminders</p>
          <ul className="mt-2 space-y-1 text-sm">
            {s.extra.alerts.slice(0, 5).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>🔔 {a.text}</span>
                <span className="text-muted-foreground">{a.date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {allLives.map((l) => {
          const t = {
            name: l.hostName || "Verified trainer",
            initials: (l.hostName || "VT").slice(0, 2).toUpperCase(),
          };
          const reserved = s.reservations.includes(l.id);
          const paid = access.has(l.id);
          return (
            <div key={l.id} className="card flex flex-col p-6">
              <div className="flex items-center gap-3">
                <Avatar initials={t.initials} />
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.when} · {l.minutes} min
                  </p>
                </div>
                <span className="chip ml-auto">{l.category}</span>
              </div>
              <h3 className="mt-4 text-xl font-bold">{l.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {l.description}
              </p>
              <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {l.level} · $5 drop-in · no subscription
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!s.signedIn) {
                      toast.error("Sign in to reserve and get reminders.");
                      return;
                    }
                    void reserve(l.id)
                      .then(() =>
                        toast.success(
                          reserved
                            ? "Reservation removed"
                            : "Reserved free. One token will be spent only on verified entry.",
                        ),
                      )
                      .catch((error) => toast.error(error.message));
                  }}
                >
                  {reserved ? (
                    <BellRing className="h-4 w-4 text-primary" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  {reserved ? "Reserved" : "Reserve"}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    void join(l);
                  }}
                  disabled={busyCheckout === l.id}
                >
                  {busyCheckout === l.id
                    ? "Opening checkout…"
                    : paid
                      ? "Join paid room"
                      : "Book class · $5"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Room({
  live,
  onLeave,
}: {
  live: LiveClass & { hostName?: string };
  onLeave: () => void;
}) {
  const t = { name: live.hostName || "Verified trainer" };
  const [isHost, setIsHost] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setIsHost(data.user?.id === live.trainerId);
    });
    return () => {
      active = false;
    };
  }, [live.trainerId]);
  return (
    <ClientOnly
      fallback={
        <div className="card grid aspect-video place-items-center">
          <p className="text-muted-foreground">Loading the room…</p>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="card grid aspect-video place-items-center">
            <p className="text-muted-foreground">Loading the room…</p>
          </div>
        }
      >
        <LiveRoom
          roomId={`live-${live.id}`}
          title={live.title}
          hostName={t.name}
          onLeave={onLeave}
          isHost={isHost}
        />
      </Suspense>
    </ClientOnly>
  );
}
