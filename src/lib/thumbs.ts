import strength from "@/assets/thumb-strength.jpg";
import yoga from "@/assets/thumb-yoga.jpg";
import family from "@/assets/thumb-family.jpg";
import cardio from "@/assets/thumb-cardio.jpg";

// Picks a workout photo for a video/live card based on its style.
export const thumbFor = (category: string) =>
  category === "Homeschool PE" ? family
  : ["Yoga", "Mobility", "Pilates", "Core"].includes(category) ? yoga
  : ["Cardio", "HIIT"].includes(category) ? cardio
  : strength;

/**
 * The CDN hostname is public and comes from Bunny Stream > library > API.
 * Never use the Stream API key or the embed signing key in browser code.
 * Only pass paths belonging to already-approved workouts.
 */
export const workoutThumbFor = (path: string | null | undefined, category: string) => {
  const fallback = thumbFor(category);
  const cdnHost = (import.meta.env["VITE_BUNNY_STREAM_CDN_HOSTNAME"] ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
  const bunny = /^bunny:\d+:([a-f0-9-]{36})$/i.exec(path ?? "");
  if (!bunny || !/^[a-z0-9.-]+\.b-cdn\.net$/.test(cdnHost))
    return fallback;
  return `https://${cdnHost}/${bunny[1]}/thumbnail.jpg`;
};
