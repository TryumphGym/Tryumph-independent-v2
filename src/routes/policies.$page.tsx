import { createFileRoute, Link } from "@tanstack/react-router";
const policies: Record<string, { title: string; body: string[] }> = {
  "trainer-agreement": {
    title: "Trainer Agreement",
    body: [
      "Trainers retain ownership of their original content and grant the platform the limited license needed to host, deliver, display and moderate authorized content. Content must respect copyright and community rules.",
      "Paid fitness offerings require current independently reviewed credentials and separately eligible payout accounts. Choosing focus tags does not establish clinical qualification. Required credentials and professional-title evidence must be accurate.",
      "There is no mandatory recurring platform fee. Native monthly memberships allocate 90% to the trainer and 10% to Tryumph; native programs 95% / 5%; private coaching 90% / 10%; live classes and eligible water-break workout video advertising 50% / 50%; community-feed advertising 100% Tryumph, after applicable actual processing fees and before hosting. External stores and affiliate commissions remain 100% trainer earnings.",
      "Verification expiry blocks new paid sales and stops future renewals. Eligible already-paid access remains until its paid period ends unless refunded, disputed or restricted for safety. Historical records and legally owed earnings are retained.",
    ],
  },
  "payout-policy": {
    title: "Trainer Payout Policy",
    body: [
      "Amounts use integer USD cents. Actual charge processing fees precede allocations. Trainer cents round down and the platform receives the remainder, so allocations reconcile to the distributable amount.",
      "Transfers depend on provider eligibility and confirmed payments. Refunds, disputes, delivery reviews and ambiguous provider operations can hold or reverse related transfers. Existing legally owed earnings are retained and reconciled; credential expiry is not confiscation.",
      "Stripe Billing, Connect, tax, foreign-exchange and other provider costs must be reviewed against actual invoices before commercial activation. Published commissions do not guarantee profitable earnings or a fixed payout date.",
    ],
  },
  "subscription-terms": {
    title: "Optional Trainer Subscription Terms",
    body: [
      "Each monthly trainer membership is optional, separately priced in USD and billed automatically until cancelled. The checkout displays the server-authoritative monthly price. Members may subscribe to multiple trainers independently.",
      "Free Trybe membership remains available. A subscription does not include separately sold programs, and a program purchase does not create a subscription.",
      "Cancel future renewal through your account. An eligible already-paid period continues until its end unless a related refund, dispute or safety moderation changes access. No unapproved price increase is applied to existing subscriptions.",
      "Failed renewal does not erase a separate paid purchase or unrelated subscription. No new period is granted without confirmed payment; payment retries and customer support remain available. Trainer verification or payout ineligibility stops future billing; money collected for an unfulfillable new period is queued for provider-confirmed refund.",
    ],
  },
  "refund-policy": {
    title: "Cancellation and Refund Policy",
    body: [
      "Contact support for refund review. Applicable law and individually disclosed service terms may provide rights beyond this draft. No blanket legal non-refundability is asserted.",
      "Private bookings retain the existing deposit, attendance, cancellation and one-time consensual transfer rules in the current Terms. Community-class reservations and token redemptions remain distinct from subscription billing.",
      "Native program and membership refunds or chargebacks adjust the related entitlement and payout ledger. A queued refund is not a completed refund. Even a partial refund can suspend the affected paid entitlement pending review; unrelated purchases remain intact.",
      "Paid-period cancellation stops future renewal; refund review is separate. Unfulfillable services and safety issues should be reported promptly.",
    ],
  },
  "digital-program-terms": {
    title: "Digital Program Purchase Terms",
    body: [
      "Programs are separate one-time purchases, free enrollments or clearly identified external-seller links. The listing and checkout disclose the price, available included content and 30-day, 90-day or lifetime access period.",
      "Confirmed purchases pin an edition so later trainer edits or unpublishing do not silently remove the purchased schedule. Safety moderation, related refunds and disputes may restrict access; contact support for review.",
      "Private downloads and videos require authorization and short-lived links. They are for the purchaser’s permitted personal use. Security controls cannot prevent all copying or screen recording. Publicly released content may already have been copied.",
      "External sellers process their own payments. Link clicks do not prove a purchase; in-app access requires independent verification. No external-sale commission is collected by Tryumph.",
    ],
  },
  "community-guidelines": {
    title: "Community Guidelines and Moderation",
    body: [
      "Respect others, protect private community information, and avoid harassment, impersonation, spam, misleading medical claims and unsafe instructions. Do not fabricate activity or professional qualifications.",
      "Public posts may be discoverable; subscriber-only posts require a paid entitlement. Free community participation remains available. Comments and interactions follow community permissions.",
      "Report content through the existing reporting tools. Administrators can review authorized evidence and subscriber content, log moderation actions, restrict offerings and consider appeals. Administrators do not receive broad unrelated private-message surveillance.",
      "Polls collect feedback only. A vote is not a reservation, attendance commitment, purchase or subscription.",
      "Community Tags are private optional impressions, displayed only after the configured minimum sample and agreement threshold. They do not establish medical suitability, professional qualifications, pregnancy or postpartum safety. No individual feedback is public.",
      "Photos stay private until processing and required moderation succeed. Fitness, pregnancy, postpartum, breastfeeding and recovery images must be considered in context. Suspected illegal sexual material requires specialist handling and cannot be previewed by ordinary moderators. Do not download or forward held originals. Appeal through Contact Us or mackenzie@tryumphgym.com.",
      "Rejected uploads and specialist holds require a professionally reviewed retention, deletion, preservation and legally required reporting procedure before uploads are activated. Ordinary removed photos must be deleted under the approved schedule; authorized legal holds take precedence. No upload rollout is authorized by this draft.",
      "Feed advertisements are labeled Sponsored and can be hidden or reported. Community-feed advertising is entirely platform revenue, separate from trainer water-break video advertising. Ads remain disabled until reviewed configuration; no artificial impressions or automatic refreshing are used.",
    ],
  },
  copyright: {
    title: "Content Ownership, Licensing and Copyright Reporting",
    body: [
      "Creators retain their original content rights. Only the license necessary to operate authorized platform features is contemplated; the final agreement requires legal review.",
      "Upload content you own or are authorized to use. Do not upload unlicensed music or third-party workouts. Notify support of suspected infringement with the specific URL, a description of your work, contact information and the basis for your claim.",
      "Contact mackenzie@tryumphgym.com. A qualified copyright reporting process, counter-notice procedure and any required agent registration must be professionally reviewed before launch. This page does not claim statutory compliance.",
    ],
  },
  "health-disclaimer": {
    title: "Fitness and Health Disclaimer",
    body: [
      "Fitness content and self-described focus labels do not diagnose, treat or cure medical conditions, establish medical qualifications or guarantee outcomes. Match activity to your individual needs and seek guidance from an appropriately qualified clinician.",
      "Pregnancy, postpartum recovery, pelvic-floor concerns, menopause, joint limitations and rehabilitation needs vary. Trainer labels are not medical clearance. Do not assume exercises while holding a baby are safe; use a safe space for your baby.",
      "Stop if you feel pain, dizziness or concerning symptoms. Seek urgent professional assistance when appropriate. You do not need to disclose a diagnosis to browse public discovery categories.",
    ],
  },
  accessibility: {
    title: "Accessibility and Support",
    body: [
      "We aim to make browsing, purchasing and community participation usable with keyboard controls, clear labels, responsive layouts and accessible form feedback. Actual assistive-technology acceptance testing remains required; no unverified compliance certification is claimed.",
      "Use discovery labels for seated, low-impact, adaptive, balance and modification-focused content. These labels are descriptions and do not guarantee an exercise is appropriate for every person.",
      "Tell us about an accessibility barrier or request assistance through Contact Us or mackenzie@tryumphgym.com. Avoid sharing medical information that is not needed for your request.",
    ],
  },
};
export const Route = createFileRoute("/policies/$page")({
  head: () => ({
    meta: [
      { title: "Marketplace policies — Tryumph Gym" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Policy,
});
function Policy() {
  const { page } = Route.useParams();
  const policy = policies[page];
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <p className="rounded border border-amber-400 bg-amber-50 p-4 text-sm text-black">
        Draft for professional legal review before production publication. These
        additions do not silently replace an approved agreement or establish
        legal compliance.
      </p>
      <h1 className="text-3xl font-bold">
        {policy?.title ?? "Marketplace policy library"}
      </h1>
      {policy?.body.map((text) => (
        <p key={text}>{text}</p>
      ))}
      <nav className="grid gap-2 sm:grid-cols-2">
        {Object.entries(policies).map(([id, p]) => (
          <Link
            className="underline"
            key={id}
            to="/policies/$page"
            params={{ page: id }}
          >
            {p.title}
          </Link>
        ))}
      </nav>
      <div className="flex gap-3">
        <Link className="underline" to="/terms">
          Existing Terms
        </Link>
        <Link className="underline" to="/privacy">
          Existing Privacy Policy
        </Link>
        <Link className="underline" to="/contact">
          Contact support
        </Link>
      </div>
    </article>
  );
}
