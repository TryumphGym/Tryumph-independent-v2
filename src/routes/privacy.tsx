import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ head: () => ({ meta: [
  { title: "Privacy Policy — Tryumph Gym" },
  { name: "description", content: "How Tryumph Gym collects, uses, protects and shares information, including advertising and cookies." },
] }), component: Privacy });
const Section = ({title,children}:{title:string;children:React.ReactNode})=><section className="card space-y-3 p-6"><h2 className="text-xl font-bold">{title}</h2>{children}</section>;
function Privacy() { return <div className="mx-auto max-w-3xl space-y-6">
  <header className="space-y-2"><p className="eyebrow">Your information</p><h1 className="text-3xl font-extrabold">Privacy Policy</h1><p className="text-muted-foreground">Updated October 27, 2026. This policy describes Tryumph Gym's online fitness service and its currently planned features. Actual vendors and advertising settings must be confirmed before activation.</p></header>
  <Section title="1. Information we collect">
    <p>We collect information needed to operate accounts, including name, email address, account role, authentication identifiers, profile and trainer certification details. Depending on how you use Tryumph, information may also include fitness goals, workout preferences, height, weight, pregnancy/postpartum preferences you choose to provide, workout history, active days, Trybe memberships, posts, comments, direct messages, video submissions, booking and transaction records, and customer-support requests.</p>
    <p>Payment card details are processed by our payment provider rather than intentionally stored as raw card numbers in Tryumph's database. We may receive transaction status, payment references, refunds and related billing data. Technical systems may process IP address, device/browser information, logs, diagnostic events, session identifiers and cookie-like technologies.</p>
  </Section>
  <Section title="2. Why we use information">
    <p>We use information to create and secure accounts; provide workouts and recommendations; administer Trybes, messaging, bookings and payments; verify trainers; deliver operational notifications; investigate abuse and fraud; provide support; and maintain and improve service reliability. We may process aggregated statistics for internal performance and safety analysis. A separate commercial insights product is not active.</p>
    <p>Fitness goals and other health-related profile information are treated as sensitive. They must not be sent to advertising partners for personalized targeting or used to build ad-targeting audiences. You should avoid putting sensitive medical information in public posts or direct messages.</p>
  </Section>
  <Section title="3. Advertising, cookies and tracking">
    <p>Some on-demand workout videos may show advertising only at designated water breaks. Videos without designated breaks should be marked Ad-Free. If enabled, third-party ad technology, including Google advertising services, may process cookies, IP addresses, device identifiers, web beacons and similar signals to serve, measure, limit and report ads. Third parties may set or read their own cookies or identifiers under their policies.</p>
    <p>Advertising services are not necessarily active at the time you read this policy. We will confirm the actual providers, disclosures, permissions and appropriate consent choices before activating ads. We do not authorize interest-based advertising targeting based on sensitive health information. You can review Google's <a className="text-primary underline" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">partner-site data practices</a> and <a className="text-primary underline" href="https://myadcenter.google.com/" target="_blank" rel="noreferrer">ad preferences</a>. Cookie controls and consent management will be added where required before third-party advertising is enabled.</p>
  </Section>
  <Section title="4. When information is shared">
    <p>We share information as necessary with service providers for authentication and storage (such as Supabase), video delivery (such as Bunny), live classes (such as LiveKit), payments (such as Stripe), hosting and security, and advertising providers only if configured. These providers process information subject to their own terms and our agreements. Payment providers may need information for payouts, fraud prevention and compliance.</p>
    <p>Your display name, public trainer profile, selected public Trybe posts or approved videos are visible to other users as indicated in the interface. Private Trybe content is intended for authorized members; direct messages are intended for their participants, subject to legally required disclosures, abuse reports and authorized security processes. We may disclose records if legally required or needed to protect users and platform safety. We do not currently operate a separate business that sells identifiable member health profiles or direct messages to advertisers.</p>
  </Section>
  <Section title="5. Storage, security and retention">
    <p>We apply authentication, access controls and other security safeguards, but no service can promise absolute security. We retain information for as long as reasonably needed to operate the service, maintain required transaction and compliance records, resolve disputes and enforce policies. Retention periods vary by record; specific retention and deletion schedules must be finalized before launch. Deleted accounts may still have records retained where legally required or necessary for fraud prevention or disputes.</p>
  </Section>
  <Section title="6. Your choices and privacy requests">
    <p>You can change some profile details and public sharing choices inside your account. You may request access to, correction of, or deletion of personal data and ask questions about applicable privacy rights through <Link to="/contact" className="text-primary underline">Contact Us</Link>. Requests may require identity verification, and some records may be retained as required by law. Where applicable, we will provide additional controls for cookies, marketing or targeted advertising before using those technologies.</p>
  </Section>
  <Section title="7. Children, changes and contact">
    <p>Tryumph's initial public fitness service is intended for adults 18 and older. We do not intentionally operate a public children's fitness or homeschool area at launch. If you believe a minor's information has been collected unexpectedly, <Link to="/contact" className="text-primary underline">contact us</Link>.</p>
    <p>We may update this policy when vendors or features change and will post a revised date and provide any notices required by law. Contact us for accessibility, safety, advertising or privacy questions.</p>
  </Section>
  <p className="text-xs text-muted-foreground">Publication checklist: confirm legal business/operator identity and contact channel; audit actual analytics/cookies and every third-party vendor; implement applicable consent/privacy preference controls; assess state privacy obligations and potential FTC health-data requirements; define retention periods; obtain legal review. Do not treat this draft alone as Google ad compliance approval.</p>
</div>; }
