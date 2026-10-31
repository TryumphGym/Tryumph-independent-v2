import { z } from "zod";
export const pollInput = z
  .object({
    trybe: z.string().min(1).max(150),
    question: z.string().trim().min(1).max(500),
    description: z.string().max(1400),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    maxSelections: z.number().int().min(1).max(6),
    expiresAt: z.string().datetime().nullable(),
    notify: z.boolean(),
    public: z.boolean(),
    id: z.string().uuid().optional(),
    revision: z.number().int().positive().optional(),
  })
  .superRefine((p, c) => {
    if (
      new Set(p.options.map((v) => v.toLocaleLowerCase())).size !==
      p.options.length
    )
      c.addIssue({
        code: "custom",
        message: "Answer options must be different",
      });
    if (p.maxSelections > p.options.length)
      c.addIssue({
        code: "custom",
        message: "Selection limit exceeds the number of options",
      });
    if (p.expiresAt && new Date(p.expiresAt).getTime() <= Date.now())
      c.addIssue({
        code: "custom",
        message: "Choose a future expiration time",
      });
  });
export type PollInput = z.infer<typeof pollInput>;
export type TrybePoll = {
  id: string;
  trybe: string;
  question: string;
  description: string;
  maxSelections: number;
  revision: number;
  expiresAt: string | null;
  closed: boolean;
  createdAt: string;
  creatorName: string;
  creatorAvatar: string | null;
  voters: number;
  resultsVisible: boolean;
  mine: string[];
  mayVote: boolean;
  mayEdit: boolean;
  mayClose: boolean;
  requiresCloseReason?: boolean;
  options: { id: string; label: string; votes: number | null }[];
};
export const pollPercent = (votes: number, voters: number) =>
  voters > 0 ? Math.round((100 * votes) / voters) : 0;
export function localPollDeadline(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Choose a valid local expiration date and time");
  return date.toISOString();
}
