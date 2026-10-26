import { ClientOnly } from "@tanstack/react-router";
import { Video } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

const LiveRoom = lazy(() => import("@/components/LiveRoom"));

// Join opens 10 minutes before the session and stays open 60 minutes after start.
export const OPEN_BEFORE_MIN = 10;
export const OPEN_AFTER_MIN = 60;

export function sessionWindow(date: string, time: string, now: Date) {
  if (time === "ALL") return "closed" as const;
  const start = new Date(`${date}T${time}:00`).getTime();
  // Trainer calendar is displayed in Central time; do not parse it in each viewer’s local zone.
  const central = now
    .toLocaleString("sv-SE", { timeZone: "America/Chicago", hour12: false })
    .replace(" ", "T");
  const t = new Date(central).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(t)) return "closed" as const;
  if (t < start - OPEN_BEFORE_MIN * 60000) return "early" as const;
  if (t > start + OPEN_AFTER_MIN * 60000) return "ended" as const;
  return "open" as const;
}

export const sessionRoomId = (trainerId: string, date: string, time: string) =>
  `oneonone-${trainerId}-${date}-${time}`;

export function SessionJoinButton({
  trainerId,
  date,
  time,
  title,
  hostName,
  isTrainer = false,
}: {
  trainerId: string;
  date: string;
  time: string;
  title: string;
  hostName: string;
  isTrainer?: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [inRoom, setInRoom] = useState(false);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(i);
  }, []);
  if (!now) return null;
  const w = sessionWindow(date, time, now);
  if (inRoom) {
    return (
      <div className="fixed inset-0 z-50 overflow-auto bg-background p-4">
        <ClientOnly
          fallback={<p className="text-muted-foreground">Loading the room…</p>}
        >
          <Suspense
            fallback={
              <p className="text-muted-foreground">Loading the room…</p>
            }
          >
            <LiveRoom
              roomId={sessionRoomId(trainerId, date, time)}
              title={title}
              hostName={hostName}
              isHost={isTrainer}
              onLeave={() => setInRoom(false)}
            />
          </Suspense>
        </ClientOnly>
      </div>
    );
  }
  if (w === "open")
    return (
      <button className="btn btn-primary" onClick={() => setInRoom(true)}>
        <Video className="h-4 w-4" />
        Join video session
      </button>
    );
  return (
    <span className="text-xs text-muted-foreground">
      {w === "early"
        ? `Join button opens ${OPEN_BEFORE_MIN} min before`
        : w === "ended"
          ? "Session ended"
          : ""}
    </span>
  );
}
