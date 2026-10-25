export const referralSources = [
  { value: "friend", label: "A friend" },
  { value: "facebook_group", label: "Facebook group post" },
  { value: "instagram", label: "Instagram" },
  { value: "google_search", label: "Google search" },
  { value: "coach", label: "A coach / fitness creator" },
  { value: "other", label: "Other" },
] as const;

export type WaitlistEntry = {
  email: string;
  role: string;
  created_at: string;
  heard_from: string | null;
  live_class_interest: string | null;
  notify_new_coaches: boolean;
};

export function referralLabel(value: string | null) {
  return referralSources.find((source) => source.value === value)?.label ?? "Not answered";
}

export function interestLabel(value: string | null) {
  return value === "yes" ? "Yes" : value === "maybe" ? "Maybe" : value === "no" ? "No" : "Not answered";
}

export function waitlistCsv(entries: WaitlistEntry[]) {
  const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return [
    ["email", "role", "joined", "heard_from", "live_class_interest_5_dollars", "notify_new_coaches"],
    ...entries.map((r) => [r.email, r.role, r.created_at, referralLabel(r.heard_from), interestLabel(r.live_class_interest), r.notify_new_coaches ? "Yes" : "No"]),
  ].map((row) => row.map(cell).join(",")).join("\r\n");
}