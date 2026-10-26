import { runtimeEnv } from "./runtime-env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
export async function signVideoPath(path: string, seconds = 3600) {
  if (path.startsWith("bunny:")) {
    const match = /^bunny:(\d+):([a-f0-9-]{36})$/i.exec(path);
    const key = runtimeEnv("BUNNY_STREAM_TOKEN_KEY");
    if (!match || !key)
      throw new Error("Secure video playback is not configured");
    const expires = Math.floor(Date.now() / 1000) + seconds;
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${key}${match[2]}${expires}`),
    );
    const token = [...new Uint8Array(bytes)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    return `https://iframe.mediadelivery.net/embed/${match[1]}/${match[2]}?token=${token}&expires=${expires}&autoplay=true`;
  }
  const signed = await supabaseAdmin.storage
    .from("videos")
    .createSignedUrl(path, seconds);
  if (signed.error || !signed.data?.signedUrl)
    throw new Error("Unable to open this workout");
  return signed.data.signedUrl;
}
