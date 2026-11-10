import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { sendContactMessage } from "@/lib/contact.functions";
import { CONTACT_EMAIL, contactTopics } from "@/lib/contact-schema";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — Tryumph Gym" },
      {
        name: "description",
        content:
          "Contact Tryumph Gym about support, billing, trainer accounts, safety or privacy.",
      },
    ],
  }),
  component: Contact,
});

const destination = CONTACT_EMAIL;
const topics = contactTopics;
type Topic = (typeof topics)[number];
function Contact() {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [topic, setTopic] = useState<Topic>("General question");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [website, setWebsite] = useState(""); // Spam trap; kept out of normal view
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (topic === "Refund request" && !auth.session?.access_token) {
        throw new Error(
          "Please sign in to request a refund so we can identify the correct account.",
        );
      }
      await sendContactMessage({
        data: {
          requestId,
          topic,
          email: replyTo,
          message,
          website,
          bookingReference:
            topic === "Refund request" ? bookingReference : undefined,
          accessToken:
            topic === "Refund request" ? auth.session?.access_token : undefined,
        },
      });
      setSent(true);
      setMessage("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "We could not send your message. Please email us directly.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <p className="eyebrow">We're here to help</p>
        <h1 className="mt-2 text-3xl font-extrabold">Contact Us</h1>
        <p className="mt-2 text-muted-foreground">
          Questions about Tryumph Gym, trainer onboarding, classes, payments,
          safety or privacy? Send us a message below.
        </p>
      </header>
      <section className="card space-y-3 p-6">
        <h2 className="text-xl font-bold">Email the Tryumph Gym team</h2>
        <p className="text-sm text-muted-foreground">
          Messages are delivered to{" "}
          <a className="text-primary underline" href={`mailto:${destination}`}>
            {destination}
          </a>
          . No email app required.
        </p>
        {sent ? (
          <div role="status" className="space-y-3 rounded-lg border p-4">
            <p className="font-semibold">Your message was submitted!</p>
            <p className="text-sm text-muted-foreground">
              We'll review your request and respond by email.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSent(false);
                setRequestId(crypto.randomUUID());
              }}
            >
              Send another message
            </button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <label className="block text-sm font-medium">
              Your email
              <input
                className="field mt-1"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium">
              Reason for contacting us
              <select
                className="field mt-1"
                value={topic}
                onChange={(e) => setTopic(e.target.value as Topic)}
              >
                {topics.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            {topic === "Refund request" && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm">
                  For your security, refund requests must be sent while signed
                  in. Your verified account ID is attached automatically. You do
                  not need to enter it.
                </p>
                <label className="block text-sm font-medium">
                  Booking or transaction reference (optional)
                  <input
                    className="field mt-1"
                    maxLength={150}
                    value={bookingReference}
                    onChange={(e) => setBookingReference(e.target.value)}
                    placeholder="Booking date or reference"
                  />
                </label>
                <Link className="text-sm text-primary underline" to="/account">
                  Sign in or view your account
                </Link>
              </div>
            )}
            <label className="block text-sm font-medium">
              Message
              <textarea
                className="field mt-1 min-h-32"
                minLength={10}
                maxLength={4000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </label>
            <div
              aria-hidden="true"
              className="absolute h-px w-px overflow-hidden opacity-0"
              style={{ left: "-9999px" }}
            >
              <label>
                Website
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => {
                    setRequestId(crypto.randomUUID());
                    setMessage("");
                    setError("");
                  }}
                >
                  Start a different message
                </button>
              </p>
            )}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send message"}
            </button>
            <p className="text-xs text-muted-foreground">
              Please don't include passwords, payment-card numbers or sensitive
              medical records.
            </p>
          </form>
        )}
      </section>
      <section className="card space-y-2 p-6">
        <h2 className="font-semibold">Helpful links</h2>
        <p className="text-sm">
          <Link className="text-primary underline" to="/terms">
            Terms and booking policies
          </Link>{" "}
          ·{" "}
          <Link className="text-primary underline" to="/privacy">
            Privacy and data requests
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          For immediate danger or medical emergencies, contact local emergency
          services instead of using this form.
        </p>
      </section>
    </div>
  );
}
