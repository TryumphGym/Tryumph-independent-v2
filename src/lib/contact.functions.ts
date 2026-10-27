import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runtimeEnv } from "@/lib/runtime-env.server";

const schema = z.object({
  email: z.string().trim().email().max(254),
  topic: z.enum(["General question","Support request","Refund request","Feature request","Trainer onboarding","Report safety or abuse","Privacy or data request","Accessibility","Advertising or partnerships"]),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).default(""), // Honeypot
  accessToken: z.string().max(5000).optional(),
  bookingReference: z.string().trim().max(150).optional(),
});
const DESTINATION = "mackenzie@tryumphgym.com";

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((raw) => schema.parse(raw))
  .handler(async ({ data }) => {
    // Don't advertise honeypot outcomes to bots.
    if (data.website.trim()) return { ok: true };
    let verifiedAccountId = "";
    if (data.topic === "Refund request") {
      if (!data.accessToken) throw new Error("Please sign in to request a refund.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: identity, error: authError } = await supabaseAdmin.auth.getUser(data.accessToken);
      if (authError || !identity.user) throw new Error("Your session expired. Please sign in again.");
      verifiedAccountId = identity.user.id;
    }
    const key = runtimeEnv("RESEND_API_KEY");
    const sender = runtimeEnv("CONTACT_FROM_EMAIL");
    if (!key || !sender || !/^.+@tryumphgym\.com$/i.test(sender)) {
      throw new Error("The contact form is not yet configured. Please email mackenzie@tryumphgym.com directly.");
    }
    const payload = {
      from: `Tryumph Gym Support <${sender}>`,
      to: [DESTINATION],
      reply_to: data.email,
      subject: `Tryumph Gym Contact: ${data.topic}`,
      text: `Topic: ${data.topic}\nFrom: ${data.email}\n${verifiedAccountId ? `Verified account ID: ${verifiedAccountId}\n` : ""}${data.bookingReference ? `Booking reference (user supplied): ${data.bookingReference}\n` : ""}\n${data.message}`,
    };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error("[Tryumph] Contact email provider rejected message:", response.status);
      throw new Error("We could not send your message right now. Please email mackenzie@tryumphgym.com directly.");
    }
    return { ok: true };
  });
