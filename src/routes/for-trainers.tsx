import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/for-trainers")({
  head: () => ({
    meta: [
      { title: "Your fitness business. Your way. — Tryumph Gym" },
      {
        name: "description",
        content:
          "Build your fitness business with programs, optional memberships, live classes, personal coaching and a free community. No mandatory platform subscription.",
      },
    ],
  }),
  component: ForTrainers,
});
const streams = [
  [
    "90%",
    "Hosted programs",
    "Sell workout programs, video courses, challenges and reviewed digital guides.",
  ],
  [
    "90%",
    "Optional monthly memberships",
    "Offer subscriber posts, protected videos and early access when memberships are activated.",
  ],
  [
    "90%",
    "One-on-one coaching",
    "Set your own rate; existing deposit, attendance and payment protections apply.",
  ],
  [
    "50%",
    "Live classes",
    "Host $5 community drop-ins without an upload quota.",
  ],
  [
    "50%",
    "Eligible free-workout advertising",
    "Earn from independently recognized ad revenue at marked water breaks only.",
  ],
  [
    "100%",
    "Independent stores and affiliate links",
    "Keep external earnings; Tryumph takes no commission on those sales.",
  ],
];
function ForTrainers() {
  return (
    <article className="space-y-10">
      <header className="max-w-4xl">
        <p className="eyebrow">For fitness professionals</p>
        <h1 className="mt-3 text-4xl font-bold md:text-6xl">
          Your fitness business. Your way.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Create workout programs, host live classes, offer personal training,
          build your own community, and earn from the content you create—all in
          one fitness-focused platform.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="btn btn-primary"
            to="/welcome"
            search={{ apply: true }}
          >
            Become a founding trainer
          </Link>
          <Link className="btn btn-outline" to="/studio">
            Open Trainer Studio
          </Link>
        </div>
      </header>
      <section>
        <h2 className="text-2xl font-bold">Multiple ways to earn</h2>
        <p className="my-3 text-sm">
          For native fitness sales, percentages apply after actual
          payment-processing fees and before hosting/infrastructure costs.
          External stores are independent. Features requiring provider
          activation remain unavailable until setup and verification are
          complete.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {streams.map(([share, title, text]) => (
            <section className="card p-6" key={title}>
              <p className="text-4xl font-bold text-primary">{share}</p>
              <h3 className="mt-2 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </section>
          ))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-6">
          <h2 className="text-2xl font-bold">Your business, your choice</h2>
          <p>
            Offer one service or several. Be a program creator, a live-class
            coach, a personal trainer, a community leader—or combine the tools
            that suit your business.
          </p>
          <p>
            Five approved videos unlock live hosting. No required monthly
            platform subscription. Optional profile photos, an introduction and
            sample workouts can help members understand your approach.
          </p>
        </div>
        <div className="card space-y-3 p-6">
          <h2 className="text-2xl font-bold">Grow your audience</h2>
          <p>
            Tryumph helps members explore trainers through goals, workout
            categories, accessibility labels, profiles, programs and
            communities. Members can discover a free workout and explore the
            creator behind it.
          </p>
          <p>
            Discovery does not guarantee followers, clients, sales or income.
          </p>
        </div>
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl font-bold">Verification builds trust</h2>
        <p>
          Current certifications and applicable CPR/AED documentation are
          independently reviewed. Paid offerings also require a separately
          eligible Stripe payout account. Selected specialties are
          self-described focus areas, not proof of medical qualification.
        </p>
        <p>
          Start with the existing signup and verification flow. Your content
          remains yours, subject to the necessary platform license and reviewed
          agreements.
        </p>
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl font-bold">Founding trainers welcome</h2>
        <p>
          Help shape a fitness community built around real people and
          independent expertise. Choose the services that fit you.
        </p>
        <Link
          className="btn btn-primary"
          to="/welcome"
          search={{ apply: true }}
        >
          Join as a fitness creator
        </Link>
        <Link
          className="ml-3 underline"
          to="/policies/$page"
          params={{ page: "trainer-agreement" }}
        >
          Review the draft trainer agreement
        </Link>
      </section>
      <p className="text-sm text-muted-foreground">
        Tryumph-sourced merchandise is a future expansion. No physical orders or
        fulfillment are activated. Existing independent trainer stores remain
        available.
      </p>
    </article>
  );
}
