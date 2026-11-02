export const FEEDBACK_TAGS = [
  ["challenging", "Challenging"],
  ["fun", "Fun"],
  ["sweaty", "Sweaty"],
  ["relaxing", "Relaxing"],
  ["beginner_friendly", "Beginner-friendly"],
  ["great_instructions", "Great instructions"],
  ["low_impact_feeling", "Low-impact feeling"],
  ["would_repeat", "Would do again"],
] as const;
export type CommunityTagSummary = { tags: string[]; respondents: number };
export type CommunityTags = Record<string, CommunityTagSummary>;
