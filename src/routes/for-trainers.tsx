import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, CalendarDays, HeartHandshake, ShieldCheck, ShoppingBag, Users, Video } from "lucide-react";
import { PageHeader } from "@/components/Avatar";

export const Route = createFileRoute("/for-trainers")({
  head: () => ({
    meta: [
      { title: "Teach on Tryumph — For Fitness Trainers" },
      { name: "description", content: "Keep 90% of 1-on-1s, 50% of live class tokens and 50% of on-demand ad revenue. Tryumph cares about its trainers." },
      { property: "og:title", content: "Teach on Tryumph Gym" },
      { property: "og:description", content: "Industry-leading splits, built-in clients and tools that take care of trainers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForTrainers,
});

const splits = [
  { pct: "90%", label: "of every 1-on-1", sub: "You set your own rate. Tryumph keeps just 10% for payments, video rooms and client matching." },
  { pct: "50/50", label: "live class split", sub: "Uncapped virtual rooms at 1 token per drop-in — no studio rent, no room limits." },
  { pct: "50/50", label: "on-demand ad share", sub: "Ads only play during water breaks, and half the revenue is yours, forever." },
];
const perks = [
  { icon: Users, t: "Clients come to you", d: "Members find you through the library, live classes and Trybes." },
  { icon: ShoppingBag, t: "Your own Trybe Store", d: "Sell merch, guides and gear with your brand on it." },
  { icon: HeartHandshake, t: "Moderated, kind community", d: "Run your own Trybe with moderator tools and review replies." },
  { icon: BarChart3, t: "Real analytics", d: "Live attendance, ad revenue, 1-on-1 earnings and follower growth." },
  { icon: CalendarDays, t: "Calendar that protects your time", d: "Block personal time so clients only book when you're available." },
  { icon: Video, t: "Build your library", d: "Publish 5 on-demand workouts to unlock live classes." },
];

function ForTrainers() {
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="For fitness trainers" title="Tryumph takes care of its trainers" sub="Do what you love. We handle billing, video, scheduling and finding your people." />
      <section className="grid gap-4 md:grid-cols-3">
        {splits.map((x) => <div key={x.label} className="card p-6"><p className="font-display text-5xl font-extrabold text-gradient">{x.pct}</p><p className="mt-2 font-semibold">{x.label}</p><p className="mt-2 text-sm text-muted-foreground">{x.sub}</p></div>)}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {perks.map(({ icon: I, t, d }) => <div key={t} className="card p-5"><I className="h-6 w-6 text-primary" /><p className="mt-3 font-semibold">{t}</p><p className="text-sm text-muted-foreground">{d}</p></div>)}
      </section>
      <section className="card flex gap-4 p-6">
        <ShieldCheck className="h-8 w-8 shrink-0 text-primary" />
        <div>
          <h2 className="text-xl font-bold">Tryumph Client Protection</h2>
          <p className="mt-2 text-sm text-muted-foreground">Any client you meet through Tryumph stays with Tryumph — sessions are booked, paid and held on the platform. In return you get industry-leading splits, zero subscription fees and a steady stream of new clients. Taking Tryumph clients off-platform ends verified trainer status.</p>
        </div>
      </section>
      <div className="text-center"><Link to="/welcome" search={{ apply: true }} className="btn btn-primary">Apply as a trainer</Link><p className="mt-2 text-xs text-muted-foreground">Certifications are reviewed before you're verified.</p></div>
    </div>
  );
}
