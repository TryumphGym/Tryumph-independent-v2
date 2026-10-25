import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Star } from "lucide-react";
import { trainers } from "@/lib/data";
import { Avatar, PageHeader } from "@/components/Avatar";

export const Route = createFileRoute("/trainers/")({
  head: () => ({
    meta: [
      { title: "Fitness Trainers — Tryumph Gym" },
      { name: "description", content: "Find independent fitness trainers for adult workouts and private 1-on-1 sessions." },
      { property: "og:title", content: "Fitness Trainers — Tryumph Gym" },
      { property: "og:description", content: "Find your coach and book private 1-on-1 sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Trainers,
});

const SPECS = ["Postpartum", "Prenatal", "Core", "Pilates", "Strength", "HIIT", "Yoga", "Mobility", "Low impact"];
const PRICES = [{ label: "Any price", max: 9999 }, { label: "Under $50", max: 49 }, { label: "Under $60", max: 59 }, { label: "Under $75", max: 74 }];

function Trainers() {
  const [role, setRole] = useState("All");
  const [spec, setSpec] = useState("All");
  const [price, setPrice] = useState("Any price");
  const [sort, setSort] = useState("rating");
  const max = PRICES.find((p) => p.label === price)!.max;
  const list = trainers
    .filter((t) => t.role === "Trainer")
    .filter((t) => spec === "All" || t.specialties.some((x) => x.toLowerCase().includes(spec.toLowerCase())))
    .filter((t) => t.rate <= max)
    .sort((a, b) => sort === "low" ? a.rate - b.rate : sort === "high" ? b.rate - a.rate : sort === "popular" ? b.followers - a.followers : b.rating - a.rating);
  return (
    <div>
      <PageHeader eyebrow="Directory" title="Fitness Trainers" sub="Independent pros, custom rates, private 1-on-1 rooms." />
      <div className="card mb-6 flex flex-col gap-3 border-primary/40 bg-primary/5 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-display text-lg font-bold">Are you a certified fitness trainer?</p>
          <p className="text-sm text-muted-foreground">Set your own rates, teach from home, and host live classes on your schedule.</p>
        </div>
        <Link to="/for-trainers" className="btn btn-primary">Apply to Teach</Link>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">{["All", ...SPECS].map((r) => <button key={r} className={`chip ${spec === r ? "chip-active" : ""}`} onClick={() => setSpec(r)}>{r === "All" ? "All specialties" : r}</button>)}</div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRICES.map((p) => <button key={p.label} className={`chip ${price === p.label ? "chip-active" : ""}`} onClick={() => setPrice(p.label)}>{p.label}</button>)}
        <select className="field ml-auto w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="rating">Top rated</option><option value="popular">Most followed</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
        </select>
      </div>
      {list.length === 0 && <p className="card p-8 text-center text-muted-foreground">No coaches match those filters yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((t) => (
          <Link key={t.id} to="/trainers/$id" params={{ id: t.id }} className="card p-6 transition hover:border-primary">
            <Avatar initials={t.initials} size="lg" />
            <p className="mt-4 font-display text-lg font-bold">{t.name}</p>
            <p className="text-sm text-primary">{t.role}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t.specialties.join(" · ")}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{t.rating}</span>
              <span className="font-semibold">${t.rate}/session</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
