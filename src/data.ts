export const TOKEN_PRICE = 5;
export const CATEGORIES = ["Strength", "Cardio", "HIIT", "Core", "Yoga", "Pilates", "Mobility"] as const;
export type Category = (typeof CATEGORIES)[number];
export const LEVELS = ["Beginner", "Intermediate", "Advanced", "Postpartum"] as const;

export const TRAINING_TIMES = ["07:00", "09:00", "12:00", "15:00", "19:00"] as const;

export type Trainer = {
  id: string; name: string; role: "Trainer" | "Nutritionist"; specialties: string[];
  quals: string[]; rate: number; rating: number; bio: string; initials: string; followers: number;
  offDays: string[]; offTimes: string[];
};
export const trainers: Trainer[] = [
  { id: "maya", name: "Maya Brooks", role: "Trainer", specialties: ["Postpartum", "Prenatal", "Core", "Pilates"], quals: ["NASM-CPT", "Pre/Postnatal Cert"], rate: 55, rating: 4.9, bio: "Mom of two helping parents rebuild strength from the living room floor.", initials: "MB", followers: 4210, offDays: ["Sun"], offTimes: ["09:00"] },
  { id: "dre", name: "Andre Cole", role: "Trainer", specialties: ["Strength", "HIIT"], quals: ["CSCS", "ACE-CPT"], rate: 65, rating: 4.8, bio: "No gym, no excuses. Dumbbells and a plan is all you need.", initials: "AC", followers: 6890, offDays: ["Mon"], offTimes: ["12:00"] },
  { id: "lena", name: "Lena Ortiz", role: "Trainer", specialties: ["Yoga", "Mobility", "Low impact", "Prenatal"], quals: ["RYT-500"], rate: 45, rating: 4.9, bio: "Quiet, calm flows for introverts and busy minds.", initials: "LO", followers: 3120, offDays: ["Sat", "Sun"], offTimes: [] },
  { id: "sam", name: "Sam Patel", role: "Nutritionist", specialties: ["Meal prep", "Family nutrition", "Postpartum nutrition"], quals: ["RDN", "MS Nutrition"], rate: 70, rating: 4.7, bio: "Budget-friendly meal plans the whole family will eat.", initials: "SP", followers: 2450, offDays: ["Wed"], offTimes: ["07:00"] },
];

export type Video = { id: string; title: string; trainerId: string; category: Category; minutes: number; level: string; postpartum?: boolean; playlist?: string; equipment?: string; pregnancySafe?: boolean; friendly?: string[]; goals?: string[] };
export const EQUIPMENT = ["No equipment", "Dumbbells", "Kettlebell", "Resistance bands", "Mini loop bands", "Yoga ball", "Yoga blocks", "Mat", "Sliders", "Step / sturdy chair", "Pull-up bar", "Jump rope", "Foam roller", "Medicine ball"] as const;
export const FRIENDLY = ["Knee friendly", "Low impact", "Back care", "Diastasis recti safe", "Pelvic floor safe", "Wrist friendly", "Joint mobility", "Seated option"] as const;
/** Gear list for a workout. Equipment text may hold several items ("Dumbbells, Mat") and health tags after a "|". */
export const gearOf = (equipment?: string) => (equipment ?? "").split("|")[0]!.split(",").map((x) => x.trim()).filter((x) => x && x !== "No equipment");
export const friendlyOf = (v: { equipment?: string; friendly?: string[] }) => [...(v.friendly ?? []), ...((v.equipment ?? "").split("|")[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean)];
export const encodeEquipment = (gear: string[], friendly: string[]) => (gear.length ? gear.join(", ") : "No equipment") + (friendly.length ? ` | ${friendly.join(", ")}` : "");
/** True when the member owns every piece of gear the workout needs (no gear saved = everything fits). */
export const fitsGear = (equipment: string | undefined, owned: string[]) => !owned.length || gearOf(equipment).every((g) => owned.includes(g));
/** Ranking boost: +3 per health need the workout supports, -6 when it needs gear the member lacks. */
export const fitScore = (v: { equipment?: string; friendly?: string[] }, owned: string[], needs: string[]) =>
  friendlyOf(v).filter((t) => needs.includes(t)).length * 3 - (fitsGear(v.equipment, owned) ? 0 : 6);
export const DURATIONS = [{ label: "Under 15 min", min: 0, max: 14 }, { label: "15–30 min", min: 15, max: 30 }, { label: "30–45 min", min: 31, max: 45 }, { label: "45+ min", min: 46, max: 999 }] as const;
export const videos: Video[] = [
  { id: "v1", title: "20-Min Full Body Dumbbell", trainerId: "dre", category: "Strength", minutes: 20, level: "Intermediate", playlist: "Garage Gains", equipment: "Dumbbells" },
  { id: "v2", friendly: ["Diastasis recti safe","Pelvic floor safe","Low impact"], title: "Diastasis-Safe Core Rebuild", trainerId: "maya", category: "Core", minutes: 15, level: "Beginner", postpartum: true, playlist: "Postpartum Path", equipment: "Mat" },
  { id: "v3", friendly: ["Low impact","Knee friendly","Back care"], title: "Morning Slow Flow", trainerId: "lena", category: "Yoga", minutes: 25, level: "Beginner", playlist: "Quiet Mornings", equipment: "Mat", pregnancySafe: true },
  { id: "v4", friendly: ["Joint mobility","Back care","Low impact","Knee friendly"], title: "Hip & Spine Reset", trainerId: "lena", category: "Mobility", minutes: 12, level: "Beginner", equipment: "Mat", pregnancySafe: true },
  { id: "v5", title: "Nap-Time HIIT", trainerId: "dre", category: "HIIT", minutes: 18, level: "Advanced", playlist: "Garage Gains", equipment: "No equipment" },
  { id: "v6", title: "Mat Pilates Sculpt", trainerId: "maya", category: "Pilates", minutes: 30, level: "Intermediate", playlist: "Postpartum Path", equipment: "Mat, Yoga ball, Sliders" },
  { id: "v7", friendly: ["Pelvic floor safe","Diastasis recti safe","Seated option"], title: "Pelvic Floor Foundations", trainerId: "maya", category: "Core", minutes: 10, level: "Beginner", postpartum: true, playlist: "Postpartum Path", equipment: "Mat", pregnancySafe: true },
  { id: "v8", title: "Lower Body Burner", trainerId: "dre", category: "Strength", minutes: 28, level: "Intermediate", equipment: "Dumbbells" },
  { id: "v9", friendly: ["Low impact","Knee friendly"], title: "Low-Impact Living Room Cardio", trainerId: "lena", category: "Cardio", minutes: 22, level: "Beginner", equipment: "No equipment", pregnancySafe: true },
  { id: "v10", friendly: ["Low impact"], title: "Stroller-Walk Cardio Intervals", trainerId: "maya", category: "Cardio", minutes: 25, level: "Beginner", postpartum: true, equipment: "No equipment", pregnancySafe: true },
  { id: "v12", friendly: ["Low impact","Knee friendly"], title: "Prenatal Gentle Strength", trainerId: "maya", category: "Strength", minutes: 20, level: "Beginner", equipment: "Resistance bands", pregnancySafe: true, playlist: "Bump-Safe Moves" },
  { id: "v13", friendly: ["Low impact","Joint mobility"], title: "Prenatal Hip Opening Flow", trainerId: "lena", category: "Yoga", minutes: 35, level: "Beginner", equipment: "Mat, Yoga blocks", pregnancySafe: true, playlist: "Bump-Safe Moves" },
  { id: "v14", title: "Kettlebell Power 45", trainerId: "dre", category: "Strength", minutes: 45, level: "Advanced", equipment: "Kettlebell" },
  { id: "v11", title: "Advanced Dance Cardio", trainerId: "dre", category: "Cardio", minutes: 30, level: "Advanced", equipment: "No equipment" },
  { id: "v15", title: "Kids & Parents Agility Drills", trainerId: "dre", category: "Homeschool PE", minutes: 20, level: "Beginner", equipment: "No equipment", playlist: "Homeschool PE" },
  { id: "v16", friendly: ["Low impact"], title: "Homeschool Movement Break", trainerId: "lena", category: "Homeschool PE", minutes: 15, level: "Beginner", equipment: "No equipment", playlist: "Homeschool PE" },
  { id: "v17", title: "Youth Calisthenics & Posture", trainerId: "dre", category: "Homeschool PE", minutes: 25, level: "Intermediate", equipment: "Mat", playlist: "Homeschool PE" },
];

export type LiveClass = { id: string; title: string; trainerId: string; category: Category; when: string; minutes: number; level: string; attendees: number; description: string };
export const liveClasses: LiveClass[] = [
  { id: "l1", title: "Postpartum Strength Live", trainerId: "maya", category: "Core", when: "Today · 7:00 PM", minutes: 40, level: "Beginner", attendees: 128, description: "Gentle, progressive core and glute work. Babies welcome on the mat." },
  { id: "l2", title: "Sweat Sesh HIIT", trainerId: "dre", category: "HIIT", when: "Tomorrow · 6:30 AM", minutes: 30, level: "Advanced", attendees: 342, description: "Fast intervals, big energy, zero equipment." },
  { id: "l3", title: "Cameras-Off Candle Yoga", trainerId: "lena", category: "Yoga", when: "Fri · 8:30 PM", minutes: 45, level: "All levels", attendees: 89, description: "Camera optional. Wind down with breath and stretch." },
  { id: "l4", title: "Kettlebell Basics", trainerId: "dre", category: "Strength", when: "Sat · 10:00 AM", minutes: 35, level: "Beginner", attendees: 210, description: "Learn the swing, goblet squat and press safely." },
];

export type Meal = { title: string; kcal: number; protein: number; carbs: number; fat: number; tag: string; ingredients: string[] };
export const meals: Meal[] = [
  { title: "15-Min Sheet Pan Chicken", kcal: 520, protein: 42, carbs: 38, fat: 20, tag: "Family", ingredients: ["Chicken thighs", "Sweet potato", "Broccoli", "Olive oil", "Garlic"] },
  { title: "Overnight Protein Oats", kcal: 380, protein: 28, carbs: 48, fat: 9, tag: "Breakfast", ingredients: ["Rolled oats", "Greek yogurt", "Milk", "Berries", "Chia seeds"] },
  { title: "Black Bean Power Bowl", kcal: 460, protein: 22, carbs: 62, fat: 14, tag: "Budget", ingredients: ["Black beans", "Brown rice", "Corn", "Salsa", "Avocado"] },
  { title: "Greek Yogurt Snack Box", kcal: 240, protein: 20, carbs: 22, fat: 8, tag: "Snack", ingredients: ["Greek yogurt", "Berries", "Almonds"] },
  { title: "Salmon & Quinoa Plate", kcal: 540, protein: 38, carbs: 40, fat: 24, tag: "Postpartum", ingredients: ["Salmon", "Quinoa", "Spinach", "Lemon"] },
  { title: "Egg & Veggie Muffins", kcal: 300, protein: 21, carbs: 8, fat: 19, tag: "Breakfast", ingredients: ["Eggs", "Bell pepper", "Spinach", "Cheddar"] },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

export const goalTrybes: { id: string; name: string; desc: string; private?: boolean }[] = [
  { id: "g-postpartum", name: "Postpartum & Diastasis Recovery", desc: "Core-safe progress, no judgement.", private: true },
  { id: "g-lowimpact", name: "Low-Impact & Knee-Friendly", desc: "Joint-kind movement for every body." },
  { id: "g-beginner", name: "Beginner Strength", desc: "First dumbbell to first push-up." },
  { id: "g-parents", name: "Busy Parents", desc: "Nap-time workouts and real-life wins." },
];
export const isPrivateTrybe = (id: string) => !!goalTrybes.find((g) => g.id === id)?.private;
export const coachTrybeNames: Record<string, string> = {};
export const trybeName = (id: string) => {
  const t = trainers.find((x) => x.id === id);
  if (t) return `${t.name.split(" ")[0]}'s Trybe`;
  return goalTrybes.find((g) => g.id === id)?.name ?? coachTrybeNames[id] ?? "Trybe";
};

export const seedPosts = [
  { id: "p1", author: "Jess R.", trybe: "maya", text: "Week 6 postpartum and finally held a full plank for 30s! 🙌", kind: "Goal", likes: 24, comments: ["So proud of you!", "Huge win 💪"] },
  { id: "p2", author: "Marcus T.", trybe: "dre", text: "Workout fail: dropped a dumbbell on the cat's toy. Cat is fine. My pride is not.", kind: "Fail", likes: 51, comments: ["😂 we've all been there"] },
  { id: "p3", author: "Priya K.", trybe: "lena", text: "Did the cameras-off yoga last night. Best sleep in months.", kind: "Win", likes: 17, comments: [] },
  { id: "p4", author: "Dana W.", trybe: "g-parents", text: "Got a 15 min workout in while the toddler 'helped'. Counts!", kind: "Win", likes: 33, comments: ["Absolutely counts!"] },
  { id: "p5", author: "Ana S.", trybe: "g-lowimpact", text: "Knee felt great after Lena's mobility video. Anyone else?", kind: "Goal", likes: 12, comments: [] },
];

export const products: { id: string; name: string; price: number; store: string; trainerId: string; url?: string }[] = [
  { id: "g1", name: "Tryumph Adjustable Dumbbells", price: 189, store: "Tryumph Fit", trainerId: "" },
  { id: "g2", name: "Non-Slip Pro Mat", price: 59, store: "Tryumph Fit", trainerId: "" },
  { id: "g3", name: "Resistance Band Set", price: 29, store: "Tryumph Fit", trainerId: "" },
  { id: "g4", name: "Maya's 'Strong Mama' Tee", price: 32, store: "Maya's Trybe Store", trainerId: "maya" },
  { id: "g5", name: "Andre 'No Excuses' Hoodie", price: 58, store: "Andre's Trybe Store", trainerId: "dre" },
  { id: "g6", name: "Lena's Calm Flow Eye Pillow", price: 18, store: "Lena's Trybe Store", trainerId: "lena" },
  { id: "g7", name: "Sam's Family Meal Prep Guide", price: 15, store: "Sam's Trybe Store", trainerId: "sam" },
];

export const trainerById = (id: string) => trainers.find((t) => t.id === id)!;

// Adult coaches need at least one certification; teens may apply once guardian consent is sent (pending or approved).
export const canSubmitCoach = (certCount: number, youth: "none" | "pending" | "approved" | "rejected") =>
  certCount > 0 || youth === "pending" || youth === "approved";
