import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { AudienceAnnouncements } from "./AudienceAnnouncements";
import { toast } from "sonner";

export function AccountNoticeCenter({
  trainer = false,
}: {
  trainer?: boolean;
}) {
  const [rows, setRows] = useState<Tables<"account_notifications">[]>([]),
    [error, setError] = useState("");
  const [preferences, setPreferences] = useState({
    session_updates: true,
    credential_updates: true,
    friend_activity: false,
    share_live_activity: false,
  });
  const [restriction, setRestriction] =
      useState<Tables<"account_restrictions"> | null>(null),
    [appeal, setAppeal] = useState("");
  const load = useCallback(async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return;
    const [notices, prefs, restricted] = await Promise.all([
      supabase
        .from("account_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("notification_preferences")
        .select(
          "session_updates,credential_updates,friend_activity,share_live_activity",
        )
        .eq("user_id", auth.data.user.id)
        .maybeSingle(),
      supabase
        .from("account_restrictions")
        .select("*")
        .eq("user_id", auth.data.user.id)
        .eq("active", true)
        .maybeSingle(),
    ]);
    setError(
      notices.error || prefs.error || restricted.error
        ? "Notifications could not be loaded. Please retry."
        : "",
    );
    if (notices.data) setRows(notices.data);
    if (prefs.data) setPreferences(prefs.data);
    setRestriction(restricted.data);
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load]);
  async function preference(key: keyof typeof preferences, value: boolean) {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return;
    const result = await supabase
      .from("notification_preferences")
      .upsert({ user_id: auth.data.user.id, ...preferences, [key]: value });
    if (result.error) toast.error("Could not save preferences");
    else setPreferences((p) => ({ ...p, [key]: value }));
  }
  return (
    <section
      className="card mb-6 space-y-3 p-5"
      aria-label="Your notification center"
    >
      <h2 className="text-xl font-bold">Notifications & announcements</h2>
      {error && (
        <p role="alert">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {restriction && (
        <div className="rounded border border-destructive p-3">
          <p>
            Your account has an active {restriction.scope} restriction:{" "}
            {restriction.reason}
          </p>
          <label className="block">
            Appeal
            <textarea
              className="field"
              maxLength={2000}
              value={appeal}
              onChange={(e) => setAppeal(e.target.value)}
            />
          </label>
          <button
            className="btn btn-outline"
            disabled={!appeal.trim()}
            onClick={() =>
              void supabase
                .from("moderation_appeals")
                .insert({ user_id: restriction.user_id, body: appeal.trim() })
                .then((r) => {
                  if (r.error) toast.error("Unable to submit appeal");
                  else {
                    toast.success("Appeal submitted for independent review");
                    setAppeal("");
                  }
                })
            }
          >
            Submit appeal
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-xs">
        {(
          [
            "session_updates",
            ...(trainer ? ["credential_updates" as const] : []),
            "friend_activity",
            "share_live_activity",
          ] as const
        ).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={(e) => void preference(key, e.target.checked)}
            />
            {
              {
                session_updates: "Session updates",
                credential_updates: "Credential reminders",
                friend_activity: "Receive friends’ community class activity",
                share_live_activity:
                  "Share my community class attendance with mutual partners",
              }[key]
            }
          </label>
        ))}
      </div>
      {rows.map((n) => (
        <article
          key={n.id}
          className={`rounded border p-3 text-sm ${n.read_at ? "text-muted-foreground" : ""}`}
        >
          <p>{n.body}</p>
          <div className="mt-2 flex gap-4 text-xs">
            <a className="underline" href={n.href}>
              View
            </a>
            {!n.read_at && (
              <button
                className="underline"
                onClick={() =>
                  void supabase
                    .from("account_notifications")
                    .update({ read_at: new Date().toISOString() })
                    .eq("id", n.id)
                    .then((r) => {
                      if (r.error) toast.error("Unable to mark read");
                      else void load();
                    })
                }
              >
                Mark read
              </button>
            )}
            <time>{new Date(n.created_at).toLocaleString()}</time>
          </div>
        </article>
      ))}
      {!rows.length && !error && (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      )}
      <AudienceAnnouncements />
    </section>
  );
}
