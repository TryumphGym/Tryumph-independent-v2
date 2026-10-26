import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, X } from "lucide-react";
import { liveClasses } from "@/lib/data";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VAPID_PUBLIC = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
const MARKS = [[10, "starts in 10 minutes"]] as const;

// Turns "Today · 7:00 PM" / "Tomorrow · 6:30 AM" / "Fri · 8:30 PM" into the next matching time.
export function parseWhen(when: string, now = new Date()): Date | null {
  const [day, time] = when.split("·").map((x) => x.trim());
  const m = time?.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!day || !m) return null;
  let h = +m[1]! % 12;
  if (m[3]!.toUpperCase() === "PM") h += 12;
  const d = new Date(now);
  d.setHours(h, +m[2]!, 0, 0);
  if (day === "Tomorrow") d.setDate(d.getDate() + 1);
  else if (day !== "Today") {
    const idx = DAYS.indexOf(day.slice(0, 3));
    if (idx < 0) return null;
    let add = (idx - now.getDay() + 7) % 7;
    if (add === 0 && d < now) add = 7;
    d.setDate(d.getDate() + add);
  }
  return d;
}

function b64ToBytes(s: string) {
  const raw = atob(
    (s + "=".repeat((4 - (s.length % 4)) % 4))
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
  );
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(
  userId: string,
): Promise<"ok" | "unsupported" | "new-tab" | "denied"> {
  if (
    !VAPID_PUBLIC ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    typeof Notification === "undefined"
  )
    return "unsupported";
  if (window.top !== window.self) return "new-tab";
  const perm =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToBytes(VAPID_PUBLIC),
    }));
  const j = sub.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  await supabase
    .from("push_subscriptions")
    .upsert({
      endpoint: j.endpoint,
      user_id: userId,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
    });
  return "ok";
}

// Schedules 10 min / 5 min / on-now reminders for reserved lives (sent even when the app is closed),
// and shows in-app toasts while it's open.
export function ReminderWatcher() {
  const { s } = useStore();
  const me = useUserId();
  const [ask, setAsk] = useState(false);
  const [lives, setLives] = useState<
    { id: string; title: string; starts_at: string }[]
  >([]);
  useEffect(() => {
    if (!s.reservations.length) {
      setLives([]);
      return;
    }
    let active = true;
    void supabase
      .from("live_sessions")
      .select("id,title,starts_at")
      .in("id", s.reservations)
      .in("status", ["scheduled", "live"])
      .then((result) => {
        if (active && !result.error) setLives(result.data);
      });
    return () => {
      active = false;
    };
  }, [s.reservations]);

  // Sync reminder times to the server so push alerts arrive when the app is closed.
  useEffect(() => {
    if (!me || !s.signedIn) return;
    const now = new Date();
    const rows = s.reservations.flatMap((id) => {
      const l = lives.find((x) => x.id === id);
      const at = l && new Date(l.starts_at);
      if (!l || !at) return [];
      return MARKS.map(([mark, label]) => ({
        user_id: me,
        live_id: id,
        body: `${l.title} ${label}`,
        fire_at: new Date(at.getTime() - mark * 60000).toISOString(),
      })).filter((r) => new Date(r.fire_at).getTime() > now.getTime() - 60000);
    });
    void (async () => {
      await supabase
        .from("push_reminders")
        .delete()
        .eq("user_id", me)
        .eq("sent", false)
        .not(
          "live_id",
          "in",
          `(${s.reservations.map((r) => `"${r}"`).join(",") || '""'})`,
        );
      if (rows.length)
        await supabase
          .from("push_reminders")
          .upsert(rows, {
            onConflict: "user_id,live_id,fire_at",
            ignoreDuplicates: true,
          });
    })();
    if (
      VAPID_PUBLIC &&
      s.reservations.length &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default" &&
      !localStorage.getItem("tryumph-push-asked")
    )
      setAsk(true);
  }, [me, s.signedIn, s.reservations, lives]);

  // New-live alerts from Trybes the member joined.
  const joined = s.extra.joinedTrybes;
  useEffect(() => {
    if (!me || !s.signedIn || joined.length === 0) return;
    const check = async () => {
      const since =
        localStorage.getItem("tryumph-live-seen") ??
        new Date(Date.now() - 86400000).toISOString();
      const { data } = await supabase
        .from("posts")
        .select("id,text,author_name,created_at")
        .eq("kind", "New live")
        .in("trybe", joined)
        .gt("created_at", since)
        .order("created_at");
      for (const p of data ?? []) {
        toast(`${p.author_name.split(" ")[0]} scheduled a live`, {
          description: p.text,
        });
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        )
          new Notification("New live class", { body: p.text });
      }
      if (data?.length)
        localStorage.setItem(
          "tryumph-live-seen",
          data[data.length - 1]!.created_at,
        );
    };
    void check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [me, s.signedIn, joined.join(",")]);

  useEffect(() => {
    if (!s.signedIn || s.reservations.length === 0) return;
    const fired = new Set<string>(
      JSON.parse(localStorage.getItem("tryumph-fired") ?? "[]"),
    );
    const tick = () => {
      const now = new Date();
      for (const id of s.reservations) {
        const l = lives.find((x) => x.id === id);
        const at = l && new Date(l.starts_at);
        if (!l || !at) continue;
        const mins = (at.getTime() - now.getTime()) / 60000;
        for (const [mark, label] of MARKS) {
          const key = `${id}-${at.toDateString()}-${mark}`;
          if (mins <= mark && mins > mark - 2 && !fired.has(key)) {
            fired.add(key);
            toast(`🔔 ${l.title} ${label}`);
          }
        }
      }
      localStorage.setItem(
        "tryumph-fired",
        JSON.stringify([...fired].slice(-100)),
      );
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [s.signedIn, s.reservations, lives]);

  if (!ask || !me) return null;
  return (
    <div className="card fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 p-4 shadow-lg">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Get class alerts on this device?</p>
        <p className="text-muted-foreground">
          10 minutes before class — even if Tryumph is closed.
        </p>
        <button
          className="btn btn-primary mt-2"
          onClick={async () => {
            const r = await enablePush(me);
            localStorage.setItem("tryumph-push-asked", "1");
            setAsk(false);
            if (r === "ok")
              toast.success("Class alerts are on for this device");
            else if (r === "new-tab")
              toast(
                "Open Tryumph in its own tab (or the live site) to turn on alerts.",
              );
            else if (r === "denied")
              toast(
                "Alerts are blocked — allow notifications in your browser's site settings.",
              );
            else
              toast(
                "This browser doesn't support alerts. On iPhone, add Tryumph to your Home Screen first.",
              );
          }}
        >
          Turn on alerts
        </button>
      </div>
      <button
        aria-label="Dismiss"
        onClick={() => {
          localStorage.setItem("tryumph-push-asked", "1");
          setAsk(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
