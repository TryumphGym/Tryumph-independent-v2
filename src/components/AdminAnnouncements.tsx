import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Audience = "everyone" | "trainers" | "members";
export function AdminAnnouncements() {
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("everyone");
  const [busy, setBusy] = useState(false);
  const publish = async () => {
    const body = message.trim();
    if (!body || body.length > 4000) return toast.error("Use 1–4000 characters.");
    setBusy(true);
    const client = supabase as unknown as SupabaseClient;
    const result = audience === "everyone"
      ? await client.rpc("publish_official_announcement", { p_body: body })
      : await client.rpc("publish_targeted_announcement", { p_body: body, p_audience: audience });
    setBusy(false);
    if (result.error) return toast.error("Publishing failed. Check Supabase audience permissions and migration.");
    setMessage("");
    toast.success(`Announcement published to ${audience}.`);
  };
  return <section className="card space-y-3 p-5">
    <h2 className="text-xl font-bold">Tryumph Gym announcements</h2>
    <p className="text-sm text-muted-foreground">Choose who sees this message. Trainer/member messages require the restricted Supabase announcement table.</p>
    <label className="block text-sm font-medium">Audience
      <select className="field mt-1" value={audience} onChange={e => setAudience(e.target.value as Audience)}>
        <option value="everyone">Everyone (public Trybe feed)</option>
        <option value="trainers">Trainers only</option>
        <option value="members">Members only</option>
      </select>
    </label>
    <textarea className="field min-h-28" maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Share an update from Tryumph Gym…" />
    <p className="text-xs text-muted-foreground">{audience === "everyone" ? "Public announcement" : audience === "trainers" ? "Only authenticated, verified-role trainer accounts can read this message." : "Only authenticated regular members can read this message."}</p>
    <button className="btn btn-primary" disabled={busy || !message.trim()} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish official announcement"}</button>
  </section>;
}
