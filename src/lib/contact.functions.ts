import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { contactSchema } from "./contact-schema";
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((raw) => contactSchema.parse(raw))
  .handler(async ({ data }) => {
    const { deliverContactMessage } = await import("./contact.server");
    // Cloudflare overwrites this header at its edge. Do not trust arbitrary X-Forwarded-For.
    return deliverContactMessage(
      data,
      getRequest().headers.get("cf-connecting-ip") || "unknown",
    );
  });
