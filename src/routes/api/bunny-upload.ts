import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Authenticated trainer-only endpoint. The Bunny library key never reaches the browser.
export const Route = createFileRoute("/api/bunny-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = env.SUPABASE_URL;
          const publicKey = env.SUPABASE_PUBLISHABLE_KEY;
          const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
          const bunnyKey = env.BUNNY_STREAM_API_KEY;
          if (!url || !publicKey || !libraryId || !bunnyKey)
            return Response.json(
              { error: "Bunny or Supabase server variables are missing" },
              { status: 503 },
            );
          const jwt = request.headers
            .get("Authorization")
            ?.replace(/^Bearer /, "");
          if (!jwt)
            return Response.json({ error: "Sign in first" }, { status: 401 });
          const supabase = createClient(url, publicKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${jwt}` } },
          });
          const { data: auth, error: authError } =
            await supabase.auth.getUser(jwt);
          if (authError || !auth.user)
            return Response.json({ error: "Invalid session" }, { status: 401 });
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", auth.user.id)
            .maybeSingle();
          if (profileError) {
            console.error(
              "Trainer profile lookup failed:",
              profileError.message,
            );
            return Response.json(
              { error: "Unable to verify trainer profile" },
              { status: 500 },
            );
          }

          if (profile?.role !== "trainer") {
            console.error("Trainer role check failed");
            return Response.json(
              { error: "Only trainer accounts can upload workouts" },
              { status: 403 },
            );
          }
          const body = (await request.json()) as { title?: string };
          const title = body.title?.trim().slice(0, 180);
          if (!title)
            return Response.json(
              { error: "A workout title is required" },
              { status: 400 },
            );
          const created = await fetch(
            `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos`,
            {
              method: "POST",
              headers: {
                AccessKey: bunnyKey,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ title }),
            },
          );
          const video = (await created.json()) as {
            guid?: string;
            Message?: string;
          };
          if (!created.ok || !video.guid)
            return Response.json(
              { error: video.Message || `Bunny returned ${created.status}` },
              { status: 502 },
            );
          const { supabaseAdmin } =
            await import("@/integrations/supabase/client.server");
          const ownership = await supabaseAdmin
            .from("video_uploads")
            .insert({
              guid: video.guid,
              user_id: auth.user.id,
              library_id: libraryId,
            });
          if (ownership.error)
            return Response.json(
              { error: "Unable to register video ownership" },
              { status: 503 },
            );
          const expires = Math.floor(Date.now() / 1000) + 60 * 60;
          const bytes = new TextEncoder().encode(
            `${libraryId}${bunnyKey}${expires}${video.guid}`,
          );
          const hash = await crypto.subtle.digest("SHA-256", bytes);
          const signature = [...new Uint8Array(hash)]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("");
          return Response.json({
            videoId: video.guid,
            libraryId,
            expires,
            signature,
          });
        } catch (error) {
          console.error("Bunny upload authorization failed", error);
          return Response.json(
            { error: "Unable to start video upload" },
            { status: 500 },
          );
        }
      },
    },
  },
});
