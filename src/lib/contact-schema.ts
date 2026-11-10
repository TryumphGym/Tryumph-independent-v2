import { z } from "zod";
export const contactTopics = [
  "General question",
  "Support request",
  "Refund request",
  "Feature request",
  "Trainer onboarding",
  "Report safety or abuse",
  "Privacy or data request",
  "Accessibility",
  "Advertising or partnerships",
] as const;
export const contactSchema = z.object({
  requestId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  topic: z.enum(contactTopics),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).default(""),
  accessToken: z.string().max(5000).optional(),
  bookingReference: z.string().trim().max(150).optional(),
});
export type ContactMessage = z.infer<typeof contactSchema>;
export const CONTACT_EMAIL = "mackenzie@tryumphgym.com";
