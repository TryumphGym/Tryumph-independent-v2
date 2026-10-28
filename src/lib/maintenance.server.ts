import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stopRecordedClass } from "./recording-control.server";
import { processRefundJobs } from "./refunds.server";
export async function runMaintenance() {
  const { advancePresentPrivateSessions } =
    await import("./private-payments.server");
  const attendance = await Promise.allSettled([
    advancePresentPrivateSessions(),
  ]);
  const preparation = [
    ...attendance,
    ...(await Promise.allSettled([
      supabaseAdmin.rpc("generate_live_session_reminders", {}).then((r) => {
        if (r.error) throw r.error;
      }),
      supabaseAdmin.rpc("generate_credential_alerts", {}).then((r) => {
        if (r.error) throw r.error;
      }),
      supabaseAdmin.rpc("maintain_private_bookings", {}).then((r) => {
        if (r.error) throw r.error;
      }),
    ])),
  ];
  const results = [
    ...preparation,
    ...(await Promise.allSettled([
      processRefundJobs(),
      closeRooms(),
      closePrivateRooms(),
    ])),
  ];
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

export async function closePrivateRooms() {
  const jobs = await supabaseAdmin
    .from("private_room_shutdown_jobs")
    .select("booking_id")
    .is("completed_at", null)
    .limit(100);
  if (jobs.error) throw jobs.error;
  const { roomService } = await import("./attendance.server");
  for (const job of jobs.data ?? []) {
    const booking = await supabaseAdmin
      .from("private_session_access")
      .select("trainer_id,day,time")
      .eq("checkout_id", job.booking_id)
      .single();
    if (booking.error) throw booking.error;
    try {
      await roomService().deleteRoom(
        `oneonone-${booking.data.trainer_id}-${booking.data.day}-${booking.data.time}`,
      );
      const done = await supabaseAdmin
        .from("private_room_shutdown_jobs")
        .update({ completed_at: new Date().toISOString(), last_error: null })
        .eq("booking_id", job.booking_id);
      if (done.error) throw done.error;
    } catch (error) {
      // Deleting an already absent room is a successful idempotent shutdown.
      const missing = (error as { code?: string }).code === "not_found";
      const saved = await supabaseAdmin
        .from("private_room_shutdown_jobs")
        .update(
          missing
            ? { completed_at: new Date().toISOString() }
            : {
                last_error:
                  "LiveKit room shutdown failed; maintenance will retry",
              },
        )
        .eq("booking_id", job.booking_id);
      if (saved.error) throw saved.error;
      if (!missing) console.error("Private room shutdown will retry", error);
    }
  }
}
