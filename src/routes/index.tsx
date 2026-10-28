import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Flame,
  Play,
  Radio,
  Trophy,
  Coins,
  Baby,
  Users,
  Trees,
  HeartPulse,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isLaunchWorkout } from "@/lib/launch";
import { gearOf } from "@/lib/data";
import { matchesWorkout } from "@/lib/workout-preferences";
import { thumbFor, workoutThumbFor } from "@/lib/thumbs";
import { useStore, streak } from "@/lib/store";
import { Waitlist } from "@/components/Waitlist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tryumph Gym — Work out on your terms" },
      {
        name: "description",
        content:
          "Free on-demand workouts, $5 drop-in live classes and supportive Trybes for real homes and busy families.",
      },
      { property: "og:title", content: "Tryumph Gym — Work out on your terms" },
      {
        property: "og:description",
        content:
          "Zero childcare guilt: free workouts, $5 live classes and Trybes for busy families.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { s } = useStore();
  const [featured, setFeatured] = useState<
    { id: string; title: string; category: string; minutes: number; path: string }[]
  >([]);
  const [upNext, setUpNext] = useState<{
    id: string;
    title: string;
    trainer_name: string;
    starts_at: string;
    minutes: number;
  } | null>(null);
  const personal = s.signedIn;
  useEffect(() => {
    let active = true;
    void (async () => {
      const [v, l, trainersResponse] = await Promise.all([
        supabase
          .from("trainer_videos")
          .select(
            "id,user_id,title,category,level,minutes,path,equipment,pregnancy_safe,required_equipment",
          )
          .eq("review_status", "approved")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("live_sessions")
          .select("id,title,trainer_id,trainer_name,starts_at,minutes")
          .eq("status", "scheduled")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(25),
        fetch("/api/public/trainers", { cache: "no-store" }).catch(() => null),
      ]);
      const verifiedTrainerIds = new Set<string>();
      if (trainersResponse?.ok) {
        try {
          const directory = (await trainersResponse.json()) as { trainers: { id: string }[] };
          for (const trainer of directory.trainers) verifiedTrainerIds.add(trainer.id);
        } catch { /* Fail closed: do not show unverified workouts. */ }
      }
      if (!active) return;
      setFeatured(
        (v.data ?? [])
          .filter((x) => Boolean(x.user_id && verifiedTrainerIds.has(x.user_id)))
          .filter(isLaunchWorkout)
          .filter(
            (x) =>
              !s.signedIn ||
              matchesWorkout(
                {
                  ...x,
                  equipment: x.equipment ?? "",
                  required_equipment:
                    x.required_equipment ?? gearOf(x.equipment),
                  pregnancySafe: x.pregnancy_safe,
                  postpartum: x.level === "Postpartum",
                },
                {
                  level: s.profile.level,
                  styles: s.extra.styles ?? [],
                  gear: s.extra.gear ?? [],
                  needs: s.extra.conditions,
                  quiet: s.extra.quiet ?? false,
                  pregnant: s.extra.pregnant ?? false,
                  postpartum: s.profile.postpartum,
                  equipmentChosen: true,
                },
              ),
          )
          .slice(0, 6),
      );
      let nextEligible = null;
      for (const session of l.data ?? []) {
        const eligibility = await supabase.rpc("trainer_is_eligible", {
          p_user_id: session.trainer_id,
          p_live: true,
        });
        if (!eligibility.error && eligibility.data === true) {
          nextEligible = session;
          break;
        }
      }
      if (active) setUpNext(nextEligible);
    })();
    return () => {
      active = false;
    };
  }, [s.signedIn, s.profile, s.extra]);
  const stats = [
    { icon: Flame, label: "Day streak", value: streak(s.activeDays) },
    { icon: Trophy, label: "Active days", value: s.activeDays.length },
    { icon: Radio, label: "Lives attended", value: s.joined.length },
    { icon: Coins, label: "Tokens", value: s.tokens },
  ];
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-2xl border">
        <img
          src={hero}
          alt="Parent working out at home while child plays"
          width={1600}
          height={912}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="bg-fade absolute inset-0" />
        <div className="relative max-w-xl px-6 py-16 md:px-12 md:py-24">
          <p className="eyebrow">
            {s.signedIn
              ? `Welcome back, ${s.name}`
              : "Built for real homes & busy families"}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-6xl">
            Work out on your terms.{" "}
            <span className="text-gradient">Zero childcare guilt.</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Free on-demand workouts, $5 drop-in live classes, and supportive
            Trybes designed for real homes and busy families.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/on-demand" className="btn btn-primary">
              <Play className="h-4 w-4" />
              Start a free workout
            </Link>
            {!s.signedIn && (
              <Link to="/account" className="btn btn-ghost">
                Create free account
              </Link>
            )}
          </div>
        </div>
      </section>

      {!s.signedIn && <Waitlist />}

      {!s.signedIn && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Baby,
              title: "New Parents & Postpartum",
              text: "Diastasis-safe core and nap-time micro workouts.",
            },
            {
              icon: Users,
              title: "Busy Parents & Kids",
              text: "Living room and garage strength the whole family can join.",
            },
            {
              icon: Trees,
              title: "Functional & Yard-Fit",
              text: "Real-life strength for lifting, carrying and chasing.",
            },
            {
              icon: HeartPulse,
              title: "Low-Impact & Joint-Friendly",
              text: "Kind to knees, hips and backs — every generation welcome.",
            },
          ].map(({ icon: I, title, text }) => (
            <div key={title} className="card p-5">
              <I className="h-6 w-6 text-primary" />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      )}

      {s.signedIn && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map(({ icon: I, label, value }) => (
            <div key={label} className="card p-5">
              <I className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display text-3xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>
      )}

      {upNext && (
        <section className="card grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="eyebrow">Up next live</p>
            <h2 className="mt-2 text-2xl font-bold">{upNext.title}</h2>
            <p className="text-muted-foreground">
              {new Date(upNext.starts_at).toLocaleString()} · with{" "}
              {upNext.trainer_name} · {upNext.minutes} min
            </p>
          </div>
          <Link to="/live" className="btn btn-primary">
            {s.reservations.includes(upNext.id) ? "Reserved — view" : "Reserve"}
          </Link>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {personal ? "Picked for you" : "Featured on-demand"}
            </h2>
            {s.signedIn && !personal && (
              <Link to="/account" className="text-sm text-muted-foreground">
                Add your goals for personal picks →
              </Link>
            )}
          </div>
          <Link to="/on-demand" className="text-sm text-primary">
            See all
          </Link>
        </div>
        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
          {featured.map((v) => (
            <Link
              key={v.id}
              to="/on-demand"
              search={{ v: v.id }}
              className="card w-64 shrink-0 snap-start overflow-hidden transition hover:border-primary"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={workoutThumbFor(v.path, v.category)}
                  onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = thumbFor(v.category); }}
                  alt=""
                  loading="lazy"
                  width={1088}
                  height={608}
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Play className="h-4 w-4" />
                  </span>
                </span>
                <span className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold">
                  {v.minutes} min
                </span>
              </div>
              <div className="p-4">
                <p className="eyebrow">{v.category}</p>
                <p className="mt-1 font-semibold">{v.title}</p>
                <p className="text-sm text-muted-foreground">
                  Approved workout · {v.minutes} min
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {!(s.signedIn && s.role === "trainer") && <section className="card grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="eyebrow">For coaches</p>
          <h2 className="mt-2 text-2xl font-bold">Coach with Tryumph</h2>
          <p className="text-muted-foreground">
            Reach families who need you — uncapped live classes, 1-on-1s at your
            rate, and a free storefront.
          </p>
        </div>
        <Link to="/for-trainers" className="btn btn-primary">
          Become a coach
        </Link>
      </section>}
    </div>
  );
}
