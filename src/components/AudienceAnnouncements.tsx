import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Notice = { id: string; body: string; audience: "trainers" | "members"; created_at: string };
export function AudienceAnnouncements() {
  const [announcements, setAnnouncements] = useState<Notice[]>([]);
  useEffect(() => {
    let active = true;
    const db = supabase as unknown as SupabaseClient;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      return db.from("audience_announcements")
        .select("id,body,audience,created_at")
        .order("created_at", { ascending: false }).limit(10)
        .then(({ data: rows, error }) => {
          if (active && !error) setAnnouncements((rows ?? []) as Notice[]);
        });
    });
    return () => { active = false; };
  }, []);
  if (!announcements.length) return null;
  return <section className="space-y-3" aria-label="Tryumph Gym announcements">
    {announcements.map(item => <article key={item.id} className="card border-primary/40 p-5">
      <p className="text-sm font-semibold text-primary">Official Tryumph Gym · {item.audience === "trainers" ? "Trainer notice" : "Member notice"}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{item.body}</p>
      <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</p>
    </article>)}
  </section>;
}
