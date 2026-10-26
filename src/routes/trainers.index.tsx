import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar, PageHeader } from "@/components/Avatar";
import type { PublicTrainer } from "@/lib/public-trainers";

export const Route = createFileRoute("/trainers/")({
  head: () => ({ meta: [{ title: "Fitness Trainers — Tryumph Gym" }, { name: "description", content: "Meet verified fitness trainers on Tryumph Gym." }] }),
  component: Trainers,
});
const SPECS = ["Postpartum", "Prenatal", "Core", "Pilates", "Strength", "HIIT", "Yoga", "Mobility", "Low impact"];
const PRICES = [{ label: "Any price", max: Infinity }, { label: "Under $50", max: 50 }, { label: "Under $60", max: 60 }, { label: "Under $75", max: 75 }];
function Trainers() {
  const [trainers, setTrainers] = useState<PublicTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [spec, setSpec] = useState("All");
  const [price, setPrice] = useState("Any price");
  const [sort, setSort] = useState("name");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/trainers", { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error("Directory unavailable");
      return r.json() as Promise<{ trainers: PublicTrainer[] }>;
    }).then(r => { setTrainers(r.trainers); setError(false); }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const max = PRICES.find(p => p.label === price)!.max;
  const list = trainers.filter(t => spec === "All" || t.specialties.some(x => x.toLowerCase().includes(spec.toLowerCase())))
    .filter(t => t.rate < max).sort((a, b) => sort === "low" ? a.rate - b.rate : sort === "high" ? b.rate - a.rate : a.name.localeCompare(b.name));
  return <div>
    <PageHeader eyebrow="Directory" title="Fitness Trainers" sub="Verified independent trainers, custom rates, private 1-on-1 sessions." />
    <div className="card mb-6 flex flex-col gap-3 border-primary/40 bg-primary/5 p-5 sm:flex-row sm:items-center">
      <div className="flex-1"><p className="font-display text-lg font-bold">Are you a certified fitness trainer?</p><p className="text-sm text-muted-foreground">Set your own rates, teach from home, and host live classes on your schedule.</p></div>
      <Link to="/for-trainers" className="btn btn-primary">Apply to Teach</Link>
    </div>
    <div className="mb-3 flex flex-wrap gap-2">{["All", ...SPECS].map(r => <button key={r} className={`chip ${spec === r ? "chip-active" : ""}`} onClick={() => setSpec(r)}>{r === "All" ? "All specialties" : r}</button>)}</div>
    <div className="mb-6 flex flex-wrap items-center gap-2">{PRICES.map(p => <button key={p.label} className={`chip ${price === p.label ? "chip-active" : ""}`} onClick={() => setPrice(p.label)}>{p.label}</button>)}
      <select className="field ml-auto w-auto" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="name">Name</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option></select>
    </div>
    {loading && <p className="card p-8 text-center">Loading verified trainers…</p>}
    {error && <p className="card p-8 text-center">Unable to load trainers right now. Please try again.</p>}
    {!loading && !error && list.length === 0 && <p className="card p-8 text-center text-muted-foreground">No verified coaches match those filters yet.</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{list.map(t => <Link key={t.id} to="/trainers/$id" params={{ id: t.id }} className="card p-6 transition hover:border-primary">
      {t.avatarUrl ? <img src={t.avatarUrl} alt={`${t.name} profile`} className="h-16 w-16 rounded-full object-cover" loading="lazy" referrerPolicy="no-referrer" /> : <Avatar initials={t.name.split(/\s+/).map(x => x[0] ?? "").join("").slice(0, 2).toUpperCase()} size="lg" />}
      <p className="mt-4 font-display text-lg font-bold">{t.name}</p><p className="text-sm text-primary">Verified trainer</p>
      <p className="mt-2 text-sm text-muted-foreground">{t.specialties.join(" · ")}</p>
      <div className="mt-4 text-sm font-semibold">${t.rate}/session</div>
    </Link>)}</div>
  </div>;
}
