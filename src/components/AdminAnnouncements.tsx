import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export function AdminAnnouncements() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const publish = async () => {
    const body = message.trim();
    if (!body || body.length > 4000) return toast.error("Use 1–4000 characters.");
    setBusy(true);
    const { error } = await (supabase as unknown as SupabaseClient)
      .rpc("publish_official_announcement", { p_body: body });
    setBusy(false);
    if (error) return toast.error("Unable to publish. Check the database function and admin role.");
    setMessage("");
    toast.success("Announcement published.");
  };
  return <section className="card space-y-3 p-5">
    <h2 className="text-xl font-bold">Tryumph Gym announcements</h2>
    <p className="text-sm text-muted-foreground">Official announcements appear in Public discovery and members' Trybe feeds.</p>
    <textarea className="field min-h-28" maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Share an update from Tryumph Gym…" />
    <button className="btn btn-primary" disabled={busy || !message.trim()} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish official announcement"}</button>
  </section>;
}
