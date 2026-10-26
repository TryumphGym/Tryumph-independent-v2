export const TOKEN_PRICE = 5;
export const CATEGORIES = [
  "Strength",
  "Cardio",
  "HIIT",
  "Core",
  "Yoga",
  "Pilates",
  "Mobility",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Postpartum",
] as const;

export const TRAINING_TIMES = [
  "07:00",
  "09:00",
  "12:00",
  "15:00",
  "19:00",
] as const;

export type Trainer = {
  id: string;
  name: string;
  role: "Trainer" | "Nutritionist";
  specialties: string[];
  quals: string[];
  rate: number;
  rating: number;
  bio: string;
  initials: string;
  followers: number;
  offDays: string[];
  offTimes: string[];
};
export const trainers: Trainer[] = [];

export type Video = {
  id: string;
  title: string;
  trainerId: string;
  category: Category | "Homeschool PE";
  minutes: number;
  level: string;
  postpartum?: boolean;
  playlist?: string;
  equipment?: string;
  pregnancySafe?: boolean;
  friendly?: string[];
  goals?: string[];
};
export const EQUIPMENT = [
  "No equipment",
  "Dumbbells",
  "Kettlebell",
  "Resistance bands",
  "Mini loop bands",
  "Yoga ball",
  "Yoga blocks",
  "Mat",
  "Sliders",
  "Step / sturdy chair",
  "Pull-up bar",
  "Jump rope",
  "Foam roller",
  "Medicine ball",
] as const;
export const FRIENDLY = [
  "Knee friendly",
  "Low impact",
  "Back care",
  "Diastasis recti safe",
  "Pelvic floor safe",
  "Wrist friendly",
  "Joint mobility",
  "Seated option",
] as const;
/** Gear list for a workout. Equipment text may hold several items ("Dumbbells, Mat") and health tags after a "|". */
export const gearOf = (equipment?: string) =>
  (equipment ?? "")
    .split("|")[0]!
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x && x !== "No equipment");
export const friendlyOf = (v: { equipment?: string; friendly?: string[] }) => [
  ...(v.friendly ?? []),
  ...((v.equipment ?? "").split("|")[1] ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
];
export const encodeEquipment = (
  gear: string[],
  friendly: string[],
  goals: string[] = [],
) =>
  (gear.length ? gear.join(", ") : "No equipment") +
  (friendly.length || goals.length ? ` | ${friendly.join(", ")}` : "") +
  (goals.length ? ` | ${goals.join(", ")}` : "");
/** True when the member owns every piece of gear the workout needs (no gear saved = everything fits). */
export const fitsGear = (equipment: string | undefined, owned: string[]) =>
  !owned.length || gearOf(equipment).every((g) => owned.includes(g));
/** Ranking boost: +3 per health need the workout supports, -6 when it needs gear the member lacks. */
export const fitScore = (
  v: { equipment?: string; friendly?: string[] },
  owned: string[],
  needs: string[],
) =>
  friendlyOf(v).filter((t) => needs.includes(t)).length * 3 -
  (fitsGear(v.equipment, owned) ? 0 : 6);
export const DURATIONS = [
  { label: "Under 15 min", min: 0, max: 14 },
  { label: "15–30 min", min: 15, max: 30 },
  { label: "30–45 min", min: 31, max: 45 },
  { label: "45+ min", min: 46, max: 999 },
] as const;
export const videos: Video[] = [];

export type LiveClass = {
  id: string;
  title: string;
  trainerId: string;
  category: Category;
  when: string;
  minutes: number;
  level: string;
  attendees: number;
  description: string;
};
export const liveClasses: LiveClass[] = [];

export type Meal = {
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tag: string;
  ingredients: string[];
};
export const meals: Meal[] = [
  {
    title: "15-Min Sheet Pan Chicken",
    kcal: 520,
    protein: 42,
    carbs: 38,
    fat: 20,
    tag: "Family",
    ingredients: [
      "Chicken thighs",
      "Sweet potato",
      "Broccoli",
      "Olive oil",
      "Garlic",
    ],
  },
  {
    title: "Overnight Protein Oats",
    kcal: 380,
    protein: 28,
    carbs: 48,
    fat: 9,
    tag: "Breakfast",
    ingredients: [
      "Rolled oats",
      "Greek yogurt",
      "Milk",
      "Berries",
      "Chia seeds",
    ],
  },
  {
    title: "Black Bean Power Bowl",
    kcal: 460,
    protein: 22,
    carbs: 62,
    fat: 14,
    tag: "Budget",
    ingredients: ["Black beans", "Brown rice", "Corn", "Salsa", "Avocado"],
  },
  {
    title: "Greek Yogurt Snack Box",
    kcal: 240,
    protein: 20,
    carbs: 22,
    fat: 8,
    tag: "Snack",
    ingredients: ["Greek yogurt", "Berries", "Almonds"],
  },
  {
    title: "Salmon & Quinoa Plate",
    kcal: 540,
    protein: 38,
    carbs: 40,
    fat: 24,
    tag: "Postpartum",
    ingredients: ["Salmon", "Quinoa", "Spinach", "Lemon"],
  },
  {
    title: "Egg & Veggie Muffins",
    kcal: 300,
    protein: 21,
    carbs: 8,
    fat: 19,
    tag: "Breakfast",
    ingredients: ["Eggs", "Bell pepper", "Spinach", "Cheddar"],
  },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export const goalTrybes: {
  id: string;
  name: string;
  desc: string;
  private?: boolean;
}[] = [
  {
    id: "g-postpartum",
    name: "Postpartum & Diastasis Recovery",
    desc: "Core-safe progress, no judgement.",
    private: true,
  },
  {
    id: "g-lowimpact",
    name: "Low-Impact & Knee-Friendly",
    desc: "Joint-kind movement for every body.",
  },
  {
    id: "g-beginner",
    name: "Beginner Strength",
    desc: "First dumbbell to first push-up.",
  },
  {
    id: "g-parents",
    name: "Busy Parents",
    desc: "Nap-time workouts and real-life wins.",
  },
];
export const isPrivateTrybe = (id: string) =>
  !!goalTrybes.find((g) => g.id === id)?.private;
export const coachTrybeNames: Record<string, string> = {};
export const trybeName = (id: string) => {
  const t = trainers.find((x) => x.id === id);
  if (t) return `${t.name.split(" ")[0]}'s Trybe`;
  return (
    goalTrybes.find((g) => g.id === id)?.name ?? coachTrybeNames[id] ?? "Trybe"
  );
};

export const seedPosts: {
  id: string;
  author: string;
  trybe: string;
  text: string;
  kind: string;
  likes: number;
  comments: string[];
}[] = [];

export const products: {
  id: string;
  name: string;
  price: number;
  store: string;
  trainerId: string;
  url?: string;
}[] = [];

export const trainerById = (id: string) => trainers.find((t) => t.id === id)!;

// Adult coaches need at least one certification; teens may apply once guardian consent is sent (pending or approved).
export const canSubmitCoach = (
  certCount: number,
  youth: "none" | "pending" | "approved" | "rejected",
) => certCount > 0 || youth === "pending" || youth === "approved";
