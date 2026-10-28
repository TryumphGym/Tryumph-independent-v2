/** Server-only live room authorization. Do not issue tokens for arbitrary room names. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function authorizeLiveRoom(userId: string, room: string) {
  const active = await supabaseAdmin.rpc("account_can_act", {
    p_id: userId,
    p_content: false,
  });
  if (active.error || !active.data)
    throw new Error("This account is restricted");
  const match = /^live-([0-9a-f]{8}-[0-9a-f-]{27,})$/i.exec(room);
  if (!match) {
    const privateMatch =
      /^oneonone-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2})$/i.exec(
        room,
      );
    if (!privateMatch) throw new Error("Invalid room");
    const { data: booking, error: privateError } = await supabaseAdmin
      .from("private_session_access")
      .select(
        "trainer_id,member_id,starts_at,status,payment_version,both_present_at",
      )
      .eq("trainer_id", privateMatch[1]!)
      .eq("day", privateMatch[2]!)
      .eq("time", privateMatch[3]!)
      .in("status", ["paid", "deposit_paid", "balance_pending"])
      .maybeSingle();
    if (
      privateError ||
      !booking ||
      (booking.member_id !== userId && booking.trainer_id !== userId)
    )
      throw new Error("A paid private booking is required");
    const start = new Date(booking.starts_at).getTime();
    const expiresAt =
      booking.payment_version === 2
        ? booking.both_present_at
          ? Date.parse(booking.both_present_at) + 60 * 60000
          : start + 15 * 60000
        : start + 60 * 60000;
    if (
      !Number.isFinite(start) ||
      Date.now() < start - 10 * 60000 ||
      Date.now() > expiresAt
    )
      throw new Error("Private session is outside its access window");
    const eligible = await supabaseAdmin.rpc("trainer_is_eligible", {
      p_user_id: booking.trainer_id,
      p_live: false,
    });
    if (eligible.error || !eligible.data)
      throw new Error("Trainer credentials are no longer current");
    return {
      isHost: booking.trainer_id === userId,
      isPrivate: true,
      waiting: booking.status !== "paid",
      expiresAt,
    };
  }
  const { data: session, error } = await supabaseAdmin
    .from("live_sessions")
    .select("id,trainer_id,starts_at,status,minutes")
    .eq("id", match[1]!)
    .single();
  if (error || !session || !["scheduled", "live"].includes(session.status))
    throw new Error("Class not found");
  const now = Date.now();
  const start = new Date(session.starts_at).getTime();
  if (
    !Number.isFinite(start) ||
    now < start - 10 * 60_000 ||
    now > start + (session.minutes + 15) * 60_000
  ) {
    throw new Error("Class room is outside its access window");
  }
  const eligible = await supabaseAdmin.rpc("trainer_is_eligible", {
    p_user_id: session.trainer_id,
    p_live: true,
  });
  if (eligible.error || !eligible.data)
    throw new Error("Trainer is no longer eligible to host");
  if (session.trainer_id === userId)
    return {
      isHost: true,
      isPrivate: false,
      waiting: false,
      expiresAt: start + (session.minutes + 15) * 60000,
    };
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("live_room_access")
    .select("id,status")
    .eq("session_id", session.id)
    .eq("user_id", userId)
    .in("status", ["paid", "pending"])
    .maybeSingle();
  if (bookingError || !booking)
    throw new Error("A paid booking is required to join this class");
  if (booking.status === "pending") {
    const lots = await supabaseAdmin
      .from("wallet_token_lots")
      .select("remaining")
      .eq("user_id", userId)
      .eq("frozen", false)
      .gt("remaining", 0)
      .limit(1);
    if (lots.error || !lots.data?.length)
      throw new Error("A purchased token is required before room entry");
  }
  return {
    isHost: false,
    isPrivate: false,
    waiting: booking.status === "pending",
    expiresAt: start + (session.minutes + 15) * 60000,
  };
}
