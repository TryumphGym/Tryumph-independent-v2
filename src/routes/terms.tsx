import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service & Fitness Waiver — Tryumph Gym" },
      {
        name: "description",
        content:
          "Tryumph Gym member and trainer terms, fitness safety, payments, content and community rules.",
      },
    ],
  }),
  component: Terms,
});
const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="card space-y-3 p-6">
    <h2 className="text-xl font-bold">{title}</h2>
    {children}
  </section>
);

function Terms() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="eyebrow">Legal</p>
        <h1 className="text-3xl font-extrabold">
          Terms of Service & Fitness Waiver
        </h1>
        <p className="text-sm text-muted-foreground">
          Updated October 27, 2026 · Applies to Tryumph Gym's U.S. fitness
          platform. Please read before participating or publishing content.
        </p>
      </header>
      <Section title="1. Using Tryumph Gym">
        <p>
          Tryumph Gym provides an online platform to discover and watch
          workouts, participate in creator-led communities ("Trybes"), and,
          where available, reserve live classes or private sessions with
          independent trainers. Users must provide accurate account information,
          protect their credentials and follow applicable laws and platform
          rules. The launch service is intended for adults aged 18 and older in
          the United States; youth and homeschool features are not part of this
          launch.
        </p>
        <p>
          We may restrict accounts or content for safety, fraud, harassment,
          expired credentials, or policy violations, subject to applicable law.
          Do not impersonate others, harass members, spam trainers, or share
          someone else's private information.
        </p>
      </Section>
      <Section title="2. Fitness participation and health">
        <p>
          Exercise carries risks, including injury. Workouts and trainer
          communications provide general fitness information, not medical care,
          diagnosis or treatment. Consider professional medical advice before
          beginning or changing an exercise program, especially if pregnant,
          postpartum, injured, or managing a health condition.
        </p>
        <p>
          Use equipment appropriately, maintain a safe exercise space, work
          within your limits and stop if you experience symptoms that concern
          you. In an emergency, contact local emergency services. To the extent
          permitted by applicable law, you accept the ordinary risks inherent in
          voluntary exercise participation; nothing in these terms waives rights
          that cannot lawfully be waived or excludes liability where doing so
          would be unlawful.
        </p>
      </Section>
      <Section title="3. Trainers and credentials">
        <p>
          Trainers are independent providers, not medical professionals acting
          on behalf of Tryumph. Trainers must provide genuine certification
          information, maintain current required credentials (including
          applicable CPR/AED verification), follow fitness safety guidelines and
          maintain any legally required permissions or insurance. Tryumph may
          review credentials and suspend new uploads, classes or private
          bookings when required credentials are missing or expired. Previously
          approved content may remain available unless it presents a separate
          safety concern.
        </p>
        <p>
          Trainers must have five approved on-demand workouts before hosting
          live classes. Trainer access, review and payout eligibility are
          subject to platform verification. Trainer listings, certifications and
          reviews do not guarantee any particular fitness result.
        </p>
      </Section>
      <Section title="4. Prices, reservations, deposits and refunds">
        <p>
          On-demand workouts are available without a required paid membership;
          eligible videos may contain advertising during trainer-designated
          water breaks. Live drop-in classes cost $5 per class unless a
          specifically authorized price change is disclosed. Reservations are
          free. A purchased token is spent once only after verified room entry;
          reconnecting or missing a reserved class does not spend another token.
          Trainers set their own private-session prices. Final prices, charges,
          cancellation deadlines and any taxes are displayed at checkout.
        </p>
        <p>
          <strong>Current checkout terms govern:</strong> A planned
          private-session model collects a 25% deposit at reservation and the
          remaining 75% after verified two-party waiting-room entry at the
          scheduled session time, with current trainer eligibility and
          successful payment required before full audio/video access. The
          deposit is credited toward the agreed total; the saved card may
          require additional authentication. This deposit model is{" "}
          <strong>not yet active</strong>; it will only apply once the checkout
          clearly presents and obtains agreement to those terms. Until then, the
          existing checkout and cancellation terms shown when booking apply. We
          will not retroactively impose a new deposit on existing bookings.
        </p>
        <p>
          When the deposit checkout is enabled, our launch policy grants a full
          refund for any unfulfilled private-session cancellation, including
          late cancellation, no-show, trainer cancellation, expired credentials
          or system failure. If both participants have not entered within 15
          minutes after the scheduled start, the unfulfilled booking is
          cancelled for refund. The member may instead request one reschedule
          with the same trainer at the same agreed price; the trainer must
          approve transferring the original deposit once, without a second
          deposit charge. A credential hold never waives the member's right to a
          refund, and renewal alone does not revive a cancelled appointment.
          Statutory rights remain available. Refund delivery may take additional
          time with the payment provider.
        </p>
        <p>
          Trainer compensation is calculated after applicable payment-processing
          fees but before hosting costs: 90% of eligible private-session revenue
          to the trainer, and 50% of eligible live-class and eligible on-demand
          advertising revenue to the trainer. New private-session earnings
          remain held until the member confirms received service after the
          session window. No mandatory recurring member or trainer subscription
          is required. External affiliate links and independently managed
          trainer stores are the trainer's own arrangements; Tryumph takes no
          commission from those external earnings.
        </p>
      </Section>
      <Section title="5. User content, communications and intellectual property">
        <p>
          You retain ownership of content you lawfully upload. By submitting it,
          you grant Tryumph a nonexclusive permission to host, process, display
          and distribute it as needed to operate the service, subject to your
          privacy settings and applicable law. You must have rights to the
          videos, images, music and other materials you provide. Trainers may
          link to licensed music services; do not upload copyrighted recordings
          without permission.
        </p>
        <p>
          Community posts, comments and private messages must comply with safety
          rules. Moderators may review reports and content they are authorized
          to access; private messages are not a general public feed. We may
          remove infringing, unsafe or abusive content. Advertising and sponsor
          content must follow applicable disclosure rules.
        </p>
      </Section>
      <Section title="6. Privacy and external services">
        <p>
          Our{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>{" "}
          explains data handling, cookies, advertising technologies, service
          providers and how to submit privacy requests. Trainers' external
          stores and links have their own terms and privacy practices. Tryumph
          cannot guarantee uptime or uninterrupted availability of third-party
          video, payment or live-streaming services.
        </p>
      </Section>
      <Section title="7. Changes, disputes and contact">
        <p>
          We may update these terms as the service evolves. Material changes
          should be communicated before they take effect where required, and
          changes do not retroactively alter completed purchases. Applicable
          consumer rights remain in effect. If a provision is unenforceable, the
          remaining terms continue as permitted by law.
        </p>
        <p>
          For questions, refund requests, accessibility issues, copyright
          complaints, or concerns about community safety, use{" "}
          <Link to="/contact" className="text-primary underline">
            Contact Us
          </Link>
          .
        </p>
      </Section>
      <p className="text-xs text-muted-foreground">
        These terms are a launch draft and require review by a qualified U.S.
        attorney for enforceability, state consumer laws, trainer relationships,
        waivers, refund terms and business-entity identification before
        production publication.
      </p>
    </div>
  );
}
