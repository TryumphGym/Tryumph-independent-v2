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
