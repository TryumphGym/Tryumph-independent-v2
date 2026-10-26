import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stopRecordedClass } from "./recording-control.server";
import { processRefundJobs } from "./refunds.server";
export async function runMaintenance() {
  const results = await Promise.allSettled([processRefundJobs(), closeRooms()]);
  for (const result of results)
    if (result.status === "rejected")
      console.error("Maintenance job will retry", result.reason);
}
async function closeRooms() {
  const expired = await supabaseAdmin
    .from("live_sessions")
    .select("id,status,starts_at,minutes")
    .in("status", ["scheduled", "live"])
    .lt("starts_at", new Date().toISOString())
    .limit(100);
  if (expired.error) throw expired.error;
  for (const session of expired.data ?? [])
    if (
      Date.now() >
      new Date(session.starts_at).getTime() + (session.minutes + 15) * 60000
    ) {
      const updated = await supabaseAdmin
        .from("live_sessions")
        .update({
          status: session.status === "scheduled" ? "cancelled" : "ended",
        })
        .eq("id", session.id);
      if (updated.error) throw updated.error;
    }

  const jobs = await supabaseAdmin
    .from("room_shutdown_jobs")
    .select("session_id")
    .is("completed_at", null)
    .limit(100);
  if (jobs.error) throw jobs.error;
  for (const job of jobs.data ?? []) {
    const session = await supabaseAdmin
      .from("live_sessions")
      .select("trainer_id")
      .eq("id", job.session_id)
      .single();
    if (session.error) throw session.error;
    await stopRecordedClass(job.session_id, session.data.trainer_id);
    const saved = await supabaseAdmin
      .from("room_shutdown_jobs")
      .update({ completed_at: new Date().toISOString() })
      .eq("session_id", job.session_id);
    if (saved.error) throw saved.error;
  }
}
