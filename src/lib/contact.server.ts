import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runtimeEnv } from "./runtime-env.server";
import {
  CONTACT_EMAIL,
  contactSchema,
  type ContactMessage,
} from "./contact-schema";
async function digest(key: string, value: string) {
  const encoder = new TextEncoder();
  const secret = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", secret, encoder.encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
/** Called by the public support form. It never refunds money or trusts a supplied
 * booking reference as ownership. Tests inject/mimic providers; no real email is sent. */
export async function deliverContactMessage(
  raw: ContactMessage,
  requesterIp: string,
) {
  const data = contactSchema.parse(raw);
  if (data.website.trim()) return { ok: true };
  let verifiedAccountId = "";
  if (data.topic === "Refund request") {
    if (!data.accessToken)
      throw new Error("Please sign in to request a refund.");
    const identity = await supabaseAdmin.auth.getUser(data.accessToken);
    if (identity.error || !identity.data.user)
      throw new Error("Your session expired. Please sign in again.");
    verifiedAccountId = identity.data.user.id;
  }
  const key = runtimeEnv("RESEND_API_KEY"),
    sender = runtimeEnv("CONTACT_FROM_EMAIL") || CONTACT_EMAIL;
  if (
    !key ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@tryumphgym\.com$/i.test(sender)
  )
    throw new Error(
      `The contact form is not yet configured. Please email ${CONTACT_EMAIL} directly.`,
    );
  const payload = {
    from: `Tryumph Gym Support <${sender}>`,
    to: [CONTACT_EMAIL],
    reply_to: data.email,
    subject: `Tryumph Gym Contact: ${data.topic}`,
    text: `Topic: ${data.topic}\nFrom: ${data.email}\n${verifiedAccountId ? `Verified account ID: ${verifiedAccountId}\n` : ""}${data.bookingReference ? `Booking reference (user supplied): ${data.bookingReference}\n` : ""}\n${data.message}`,
  };
  const serialized = JSON.stringify(payload);
  const claim = await supabaseAdmin.rpc("claim_contact_delivery", {
    p_request: data.requestId,
    p_requester_hash: await digest(key, requesterIp),
    p_payload_hash: await digest(key, serialized),
  });
  if (claim.error)
    throw new Error(
      claim.error.code === "P0001"
        ? claim.error.message
        : `The contact form is temporarily unavailable. Please email ${CONTACT_EMAIL} directly.`,
    );
  if (claim.data === "sent") return { ok: true };
  if (claim.data !== "claimed")
    throw new Error(
      "Your message is already processing. Please wait before trying again.",
    );
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `contact:${data.requestId}`,
      },
      body: serialized,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`Email provider returned ${response.status}`);
    const result = (await response.json()) as { id?: unknown };
    if (typeof result.id !== "string" || !result.id || result.id.length > 200)
      throw new Error("Email provider did not confirm receipt");
    const saved = await supabaseAdmin
      .from("contact_delivery_requests")
      .update({ status: "sent", provider_id: result.id, last_error: null })
      .eq("request_id", data.requestId);
    if (saved.error) throw saved.error;
    return { ok: true };
  } catch {
    const saved = await supabaseAdmin
      .from("contact_delivery_requests")
      .update({
        status: "failed",
        last_error:
          "Provider receipt not confirmed; retry uses the same idempotency key.",
        lease_until: new Date(Date.now() + 60000).toISOString(),
      })
      .eq("request_id", data.requestId);
    if (saved.error)
      console.error(
        "[Tryumph] Contact delivery state will require reconciliation",
      );
    throw new Error(
      `We could not confirm your message. Retry this same request or email ${CONTACT_EMAIL} directly.`,
    );
  }
}
