/** Public content labels, never diagnoses or proof of professional qualifications. Existing tags are mapped at read time. */
export const DISCOVERY = {
  goal: [
    ["weight_loss", "Weight loss"],
    ["strength", "Strength training"],
    ["core", "Core strength"],
    ["flexibility", "Flexibility"],
    ["endurance", "Endurance"],
    ["functional", "Functional fitness"],
    ["running", "Marathon / running preparation"],
    ["wellness", "General wellness"],
  ],
  life_stage: [
    ["prenatal", "Pregnancy / Prenatal"],
    ["postpartum", "Postpartum recovery"],
    ["pelvic_floor", "Pelvic floor-focused exercise"],
    ["menopause", "Menopause"],
    ["senior", "Senior fitness"],
    ["returning", "Returning after inactivity"],
  ],
  accessibility: [
    ["low_impact", "Low-impact"],
    ["joint_friendly", "Joint-friendly"],
    ["arthritis_friendly", "Arthritis-friendly"],
    ["limited_mobility", "Limited mobility"],
    ["seated", "Seated / chair workouts"],
    ["balance", "Balance and stability"],
    ["back_friendly", "Back-friendly modifications"],
    ["rehabilitation", "Rehabilitation-oriented exercise"],
    ["beginner", "Beginner-friendly"],
    ["adaptive", "Adaptive fitness"],
  ],
} as const;
export const DISCOVERY_IDS = new Set(
  Object.values(DISCOVERY)
    .flat()
    .map(([id]) => id),
);
const aliases: Record<string, RegExp> = {
  weight_loss: /weight loss|fat loss|lose weight/,
  strength: /strength|resistance|muscle/,
  core: /core|abdom|diastasis/,
  flexibility: /flexibility|stretch|mobility/,
  endurance: /endurance|cardio|stamina/,
  functional: /functional/,
  running: /running|marathon|run preparation|run a (5k|10k|half)/,
  wellness:
    /wellness|general fitness|build a habit|stress relief|increase energy/,
  prenatal: /prenatal|pregnancy/,
  postpartum: /postpartum|postnatal/,
  pelvic_floor: /pelvic.floor/,
  menopause: /menopaus/,
  senior: /senior|older adult/,
  returning: /returning|inactivity|decondition/,
  low_impact: /low.impact/,
  joint_friendly: /joint.friendly/,
  arthritis_friendly: /arthritis.friendly/,
  limited_mobility: /limited.mobility/,
  seated: /seated|chair workout/,
  balance: /balance|stability/,
  back_friendly: /back.friendly|back care/,
  rehabilitation: /rehabilitation.oriented|rehab.focus/,
  beginner: /beginner/,
  adaptive: /adaptive/,
};
export function discoveryTags(value: {
  pregnancy_safe?: boolean;
  discovery_tags?: readonly string[];
  focus_tags?: readonly string[];
  goals?: readonly string[];
  specialties?: readonly string[];
  category?: string;
  level?: string;
  equipment?: string;
  difficulty?: string;
}) {
  const tags = new Set([
    ...(value.discovery_tags ?? []),
    ...(value.focus_tags ?? []),
  ]);
  if (value.pregnancy_safe) tags.add("prenatal");
  const text = [
    ...(value.goals ?? []),
    ...(value.specialties ?? []),
    value.category,
    value.level,
    value.difficulty,
    value.equipment?.split("|").slice(1).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_-]/g, " ");
  for (const [id, pattern] of Object.entries(aliases))
    if (pattern.test(text)) tags.add(id);
  return tags;
}
export function matchesDiscovery(
  value: Parameters<typeof discoveryTags>[0],
  selected: readonly string[],
) {
  const tags = discoveryTags(value);
  return selected.every((id) => tags.has(id));
}
export const DISCOVERY_DISCLAIMER =
  "Focus labels are trainer descriptions, not medical qualifications, a diagnosis, or a promise to treat or cure a condition. Choose modifications appropriate for you. Pregnancy, postpartum recovery and health needs vary; seek individual guidance from an appropriately qualified clinician. Browsing does not require sharing a diagnosis.";

export const discoveryLabels = (ids: readonly string[]) =>
  ids.map(
    (id) =>
      Object.values(DISCOVERY)
        .flat()
        .find(([key]) => key === id)?.[1] ?? id,
  );

/** Preserve stored legacy safety tokens while avoiding blanket medical-safety claims in labels. */
export const fitnessLabel = (value: string) =>
  (
    ({
      "Pregnancy safe": "Pregnancy / prenatal (trainer-labeled)",
      "Pelvic floor safe": "Pelvic floor focus (trainer-labeled)",
      "Diastasis recti safe":
        "Diastasis-focused modifications (trainer-labeled)",
    }) as Record<string, string>
  )[value] ?? value;
