import { createFileRoute } from "@tanstack/react-router";
import { WebhookReceiver } from "livekit-server-sdk";
import { runtimeEnv } from "@/lib/runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { env } from "cloudflare:workers";

/** Signed LiveKit event; egress data is not trusted until room + recording are matched. */
export const Route = createFileRoute("/api/public/webhooks/livekit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = runtimeEnv("LIVEKIT_API_KEY"),
          secret = runtimeEnv("LIVEKIT_API_SECRET");
        if (!key || !secret)
          return new Response("LiveKit not configured", { status: 503 });
        const signature = request.headers.get("Authorization");
        if (!signature)
          return new Response("Missing signature", { status: 401 });
        let event;
        try {
          event = await new WebhookReceiver(key, secret).receive(
            await request.text(),
            signature,
          );
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        if (
          event.event === "participant_joined" &&
          event.room?.name &&
          event.participant?.identity
        ) {
          const match = /^live-([0-9a-f-]{36})$/i.exec(event.room.name);
          if (match) {
            const session = await supabaseAdmin
              .from("live_sessions")
              .select("trainer_id,status")
              .eq("id", match[1]!)
              .single();
            if (session.error)
              return new Response("Retry attendance", { status: 500 });
            if (
              session.data.trainer_id === event.participant.identity &&
              session.data.status === "scheduled"
            ) {
              const updated = await supabaseAdmin
                .from("live_sessions")
                .update({ status: "live" })
                .eq("id", match[1]!);
              if (updated.error)
                return new Response("Retry class state", { status: 500 });
            } else {
              const updated = await supabaseAdmin
                .from("live_room_access")
                .update({ first_joined_at: new Date().toISOString() })
                .eq("session_id", match[1]!)
                .eq("user_id", event.participant.identity)
                .eq("status", "paid")
                .is("first_joined_at", null);
              if (updated.error)
                return new Response("Retry attendance", { status: 500 });
            }
          }
          return new Response("ok");
        }
        if (event.event !== "egress_ended" && event.event !== "egress_updated")
          return new Response("ok");
        const info = event.egressInfo;
        if (!info?.egressId || !info.roomName) return new Response("ok");
        const match = /^live-([0-9a-f]{8}-[0-9a-f-]{27,})$/i.exec(
          info.roomName,
        );
        if (!match) return new Response("ok");
        const { data: row, error: readError } = await supabaseAdmin
          .from("live_recordings")
          .select("egress_id,session_id,trainer_id,object_key")
          .eq("egress_id", info.egressId)
          .maybeSingle();
        if (readError)
          return new Response("Database unavailable", { status: 500 });
        if (!row)
          return new Response("Recording not registered yet; retry", {
            status: 503,
          });
        if (row.session_id !== match[1]) return new Response("ok");
        const isDone = event.event === "egress_ended";
        const failed =
          isDone &&
          (Number(info.status) !== 3 ||
            !info.fileResults?.some(
              (file) =>
                file.filename === row.object_key && BigInt(file.size) > 0n,
            ));
        const status = failed ? "failed" : isDone ? "completed" : "processing";
        const { error } = await supabaseAdmin
          .from("live_recordings")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("egress_id", info.egressId);
        if (error) return new Response("Retry webhook", { status: 500 });
        if (isDone && !failed) {
          try {
            const queue = env["RECORDING_IMPORTS"] as
              | { send: (message: { egressId: string }) => Promise<void> }
              | undefined;
            if (!queue) throw new Error("Recording queue not configured");
            await queue.send({ egressId: info.egressId });
          } catch (e) {
            console.error("Recording import failed, available for retry", e);
            return new Response("Recording import retry required", {
              status: 500,
            });
          }
        }
        return new Response("ok");
      },
    },
  },
});
