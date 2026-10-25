import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Play, Radio, Trophy, Coins, Baby, Users, Trees, HeartPulse } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { liveClasses, videos, trainerById, fitScore } from "@/lib/data";
import { thumbFor } from "@/lib/thumbs";
import { useStore, streak } from "@/lib/store";
import { Waitlist } from "@/components/Waitlist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tryumph Gym — Work out on your terms" },
      { name: "description", content: "Free on-demand workouts, 1-token drop-in live classes and supportive Trybes for real homes and busy families." },
      { property: "og:title", content: "Tryumph Gym — Work out on your terms" },
      { property: "og:description", content: "Zero childcare guilt: free workouts, 1-token live classes and Trybes for busy families." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { s } = useStore();
  const followed = s.extra.followed ?? [];
  const needs = [...s.extra.conditions, ...s.extra.goals].join(" ").toLowerCase();
  const pregnant = s.extra.conditions.includes("Pregnant");
  const goalCats = [
    /postpartum|diastasis|pregnan/.test(needs) && ["Core", "Pilates", "Yoga"],
    /strength|muscle|tone/.test(needs) && ["Strength", "HIIT"],
    /weight|endurance/.test(needs) && ["Cardio", "HIIT"],
    /low impact|knee|joint|back|stress|flex/.test(needs) && ["Yoga", "Mobility"],
  ].filter(Boolean).flat() as string[];
  const liveScore = (l: (typeof liveClasses)[number]) => (s.reservations.includes(l.id) ? 100 : 0) + (followed.includes(l.trainerId) ? 10 : 0) + (goalCats.includes(l.category) ? 5 : 0);
  const upNext = s.signedIn ? [...liveClasses].sort((a, b) => liveScore(b) - liveScore(a))[0]! : liveClasses[0]!;
  const why = s.reservations.includes(upNext.id) ? "You're reserved" : followed.includes(upNext.trainerId) ? "From a coach you follow" : goalCats.includes(upNext.category) ? "Matches your goals" : "Up next live";
  const vScore = (v: (typeof videos)[number]) => (pregnant && v.pregnancySafe ? 3 : 0) + (/postpartum|diastasis/.test(needs) && v.postpartum ? 3 : 0) + (/low impact|knee/.test(needs) && v.level === "Beginner" ? 1 : 0) + (followed.includes(v.trainerId) || s.bookings.some((b) => b.trainerId === v.trainerId) ? 2 : 0) + (goalCats.includes(v.category) ? 2 : 0) - (s.history.includes(v.id) ? 1 : 0) + fitScore(v, s.extra.gear ?? [], s.extra.conditions);
  const featured = (s.signedIn ? [...videos].filter((v) => !pregnant || v.pregnancySafe).sort((a, b) => vScore(b) - vScore(a)) : videos).slice(0, 6);
  const personal = s.signedIn && (goalCats.length > 0 || followed.length > 0 || pregnant);
  const t = trainerById(upNext.trainerId);
  const stats = [
    { icon: Flame, label: "Day streak", value: streak(s.activeDays) },
    { icon: Trophy, label: "Active days", value: s.activeDays.length },
    { icon: Radio, label: "Lives attended", value: s.joined.length },
    { icon: Coins, label: "Tokens", value: s.tokens },
  ];
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border">
        <img src={hero} alt="Parent working out at home while child plays" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="bg-fade absolute inset-0" />
        <div className="relative max-w-xl px-6 py-16 md:px-12 md:py-24">
          <p className="eyebrow">{s.signedIn ? `Welcome back, ${s.name}` : "Built for real homes & busy families"}</p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-6xl">Work out on your terms. <span className="text-gradient">Zero childcare guilt.</span></h1>
          <p className="mt-4 text-muted-foreground">Free on-demand workouts, 1-token drop-in live classes, and supportive Trybes designed for real homes and busy families.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/on-demand" className="btn btn-primary"><Play className="h-4 w-4" />Start a free workout</Link>
            {!s.signedIn && <Link to="/account" className="btn btn-ghost">Create free account</Link>}
          </div>
        </div>
      </section>

      {!s.signedIn && <Waitlist />}


      {!s.signedIn && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Baby, title: "New Parents & Postpartum", text: "Diastasis-safe core and nap-time micro workouts." },
          { icon: Users, title: "Busy Parents & Kids", text: "Living room and garage strength the whole family can join." },
          { icon: Trees, title: "Functional & Yard-Fit", text: "Real-life strength for lifting, carrying and chasing." },
          { icon: HeartPulse, title: "Low-Impact & Joint-Friendly", text: "Kind to knees, hips and backs — every generation welcome." },
        ].map(({ icon: I, title, text }) => (
          <div key={title} className="card p-5"><I className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>
        ))}
      </section>}

      {s.signedIn && <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map(({ icon: I, label, value }) => (
          <div key={label} className="card p-5">
            <I className="h-5 w-5 text-primary" />
            <p className="mt-3 font-display text-3xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>}

      <section className="card grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow">{s.signedIn ? why : "Up next live"}</p>
          <h2 className="mt-2 text-2xl font-bold">{upNext.title}</h2>
          <p className="text-muted-foreground">{upNext.when} · with {t.name} · {upNext.minutes} min</p>
        </div>
        <Link to="/live" className="btn btn-primary">{s.reservations.includes(upNext.id) ? "Reserved — view" : "Reserve"}</Link>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div><h2 className="text-2xl font-bold">{personal ? "Picked for you" : "Featured on-demand"}</h2>{s.signedIn && !personal && <Link to="/account" className="text-sm text-muted-foreground">Add your goals for personal picks →</Link>}</div>
          <Link to="/on-demand" className="text-sm text-primary">See all</Link>
        </div>
        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
          {featured.map((v) => (
            <Link key={v.id} to="/on-demand" search={{ v: v.id }} className="card w-64 shrink-0 snap-start overflow-hidden transition hover:border-primary">
              <div className="relative aspect-video overflow-hidden">
                <img src={thumbFor(v.category)} alt="" loading="lazy" width={1088} height={608} className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><Play className="h-4 w-4" /></span></span>
                <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold">Preview · {v.minutes} min</span>
              </div>
              <div className="p-4">
                <p className="eyebrow">{v.category}</p>
                <p className="mt-1 font-semibold">{v.title}</p>
                <p className="text-sm text-muted-foreground">{trainerById(v.trainerId).name} · {v.minutes} min</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow">For coaches</p>
          <h2 className="mt-2 text-2xl font-bold">Coach with Tryumph</h2>
          <p className="text-muted-foreground">Reach families who need you — uncapped live classes, 1-on-1s at your rate, and a free storefront.</p>
        </div>
        <Link to="/for-trainers" className="btn btn-primary">Become a coach</Link>
      </section>
    </div>
  );
}
