import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Tryumph Gym — Fitness that fits real life." },
      {
        name: "description",
        content:
          "The story, mission and community behind Tryumph Gym, founded by Mackenzie Ryan.",
      },
    ],
  }),
  component: About,
});
function About() {
  return (
    <article className="mx-auto max-w-4xl space-y-9">
      <header>
        <p className="eyebrow">About Tryumph Gym</p>
        <h1 className="mt-3 text-4xl font-bold md:text-5xl">
          Fitness that fits real life.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Accessible fitness. Independent trainers. A community with room for
          your real life.
        </p>
      </header>
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">Our story</h2>
        <p>
          Tryumph Gym began with a mom who needed a different way to experience
          fitness. After struggling with severe postpartum depression, founder
          Mackenzie Ryan turned to at-home workouts, online videos, and fitness
          communities as part of finding herself again.
        </p>
        <p>
          Childcare, schedules, anxiety, and family life made showing up to a
          gym or a scheduled class difficult. But fitness could still happen at
          home. The tools were scattered: workouts on video platforms,
          communities in social media groups, and other services for live
          classes and personal coaching.
        </p>
        <p>
          Tryumph began with a simple idea: what if fitness, community, and
          connection could exist together in one place?
        </p>
        <p className="text-sm text-muted-foreground">
          This is Mackenzie’s personal experience. Exercise is not a substitute
          for mental-health care or individualized medical advice.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">What Tryumph is becoming</h2>
        <p>
          A fitness creator marketplace where trainers can operate their
          businesses their way and members can find fitness that works for their
          lives. Qualified professionals can build communities, publish
          workouts, host live classes, sell programs and offer personalized
          coaching.
        </p>
        <p>
          Members can explore free workouts, discover trainers, join free
          communities, and pay only for the experiences they choose. Optional
          paid trainer memberships are separate from free Trybe membership and
          separately sold programs; availability depends on each trainer’s
          verified offerings.
        </p>
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="text-2xl font-bold">Our mission</h2>
        <p>
          Make fitness more accessible, flexible, and community-driven while
          empowering qualified fitness professionals to earn from their
          expertise.
        </p>
        <h2 className="text-2xl font-bold">Be brave</h2>
        <p>
          Bravery does not mean the absence of fear. It means being afraid and
          choosing to move forward anyway. Progress doesn’t require perfection,
          and every person deserves the opportunity to begin.
        </p>
      </section>
      <section>
        <h2 className="text-2xl font-bold">Our commitment</h2>
        <ul className="mt-3 grid list-disc gap-2 pl-5 sm:grid-cols-2">
          {[
            "Accessible fitness",
            "Trainer independence",
            "Transparent compensation",
            "Genuine communities",
            "Flexible participation",
            "Respect for different goals and fitness levels",
            "Verified fitness professionals",
            "Clear pricing without mandatory member subscriptions",
          ].map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </section>
      <section className="card grid gap-5 p-6 sm:grid-cols-[100px_1fr]">
        <div
          className="grid h-24 w-24 place-items-center rounded-full bg-secondary text-3xl font-bold"
          aria-label="Founder photo placeholder"
        >
          MR
        </div>
        <div>
          <h2 className="text-2xl font-bold">Meet Mackenzie Ryan</h2>
          <p className="mt-2">
            Mackenzie is the founder of Tryumph Gym and a mom who built the
            platform from her own experience of needing more flexible fitness
            options.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Founder photo coming later. No fitness certifications or clinical
            qualifications are implied.
          </p>
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <Link className="btn btn-primary" to="/on-demand">
          Explore workouts
        </Link>
        <Link className="btn btn-outline" to="/for-trainers">
          For fitness professionals
        </Link>
      </div>
    </article>
  );
}
