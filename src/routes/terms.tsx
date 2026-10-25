import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms, Waiver & Coach Agreement — Tryumph Gym" },
      { name: "description", content: "Member activity waiver, coach terms and insurance attestation, and youth contributor consent for Tryumph Gym." },
      { property: "og:title", content: "Terms, Waiver & Coach Agreement — Tryumph Gym" },
      { property: "og:description", content: "The terms that keep Tryumph safe for members, coaches and families." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card space-y-3 p-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Terms() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="eyebrow">The fine print, in plain English</p>
        <h1 className="mt-2 text-3xl font-extrabold">Terms, Waiver & Coach Agreement</h1>
        <p className="mt-2 text-muted-foreground">
          Last updated October 2026. These terms govern your use of Tryumph Gym ("Tryumph"). By creating an account, booking a session, or uploading content, you agree to them. This is a starter template — have a lawyer review before launch.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="#member-waiver" className="chip">Member waiver</a>
          <a href="#coach-terms" className="chip">Coach terms</a>
          <a href="#youth" className="chip">Youth contributors</a>
          <a href="#payments" className="chip">Payments & refunds</a>
        </nav>
      </div>

      <Section id="member-waiver" title="1. Member Activity Waiver">
        <p>Exercise involves risk. By taking part in any Tryumph workout — live, 1-on-1, or on-demand — you confirm that:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>You are physically able to exercise, or have cleared it with your doctor — especially if you are pregnant, postpartum, or managing an injury or health condition.</li>
          <li>You are responsible for your own space, equipment, and surroundings (kids, pets, furniture, floors).</li>
          <li>You will stop immediately if you feel pain, dizziness, or shortness of breath, and seek medical care when needed.</li>
          <li>Coaches provide general fitness guidance, not medical advice, diagnosis, or treatment.</li>
        </ul>
        <p>To the fullest extent permitted by law, you release Tryumph Gym and its coaches from liability for injuries or losses arising from your participation, except where caused by our gross negligence or willful misconduct.</p>
      </Section>

      <Section id="coach-terms" title="2. Coach Terms & Insurance Attestation">
        <p>Coaches (trainers and nutritionists) are independent contractors, not employees. By coaching on Tryumph you attest that:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>You hold a current, valid certification for what you teach (e.g. NASM, ACE, ISSA, USREPS-registered, or a recognized prenatal/postpartum or nutrition credential), and you will keep it current.</li>
          <li>You carry, or will obtain before your first paid session, professional liability insurance appropriate for fitness instruction.</li>
          <li>Your submitted credentials are genuine. Tryumph may verify them and may suspend or remove your account for false or expired credentials.</li>
          <li>You will not provide medical advice, and will refer members to healthcare professionals when appropriate.</li>
          <li>You will treat members with respect. Harassment, discrimination, or inappropriate contact ends your account.</li>
        </ul>
        <p><strong>Earnings.</strong> Private 1-on-1 sessions booked through Tryumph pay you 90% of the net amount after payment processing fees. Live drop-in class revenue is shared 50/50 after fees. Payouts require a linked payout account. Tryumph is non-exclusive: your existing clients, website, and products remain yours — only bookings made through Tryumph are subject to these terms.</p>
      </Section>

      <Section id="youth" title="3. Youth Contributors (Under 18)">
        <p>We welcome youth athletic content (for example, teen athletes sharing sport drills) under these guardrails:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>A parent or legal guardian must submit written consent and a content release before any youth content is published.</li>
          <li>Youth contributors upload on-demand videos only — no live classes, no 1-on-1 sessions, no direct messaging with members, and no payouts.</li>
          <li>All youth content is reviewed by the Tryumph team before it goes live.</li>
          <li>The guardian may withdraw consent at any time, and we will remove the content promptly.</li>
        </ul>
      </Section>

      <Section id="payments" title="4. Payments, Tokens & Refunds">
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Live group classes are reserved free and cost one token when you join. 1-on-1 sessions are paid in dollars at the coach's listed rate.</li>
          <li>Tokens are non-transferable and not redeemable for cash.</li>
          <li>If a coach cancels a paid session or a live class you joined, your payment or token is returned automatically.</li>
          <li>Members may cancel a 1-on-1 up to 24 hours before start for a full refund; later cancellations are at the coach's discretion.</li>
        </ul>
        <p className="text-muted-foreground">Questions? Reach us via the <Link to="/account" className="text-primary">Account</Link> page.</p>
      </Section>
    </div>
  );
}
