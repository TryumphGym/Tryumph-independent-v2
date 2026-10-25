import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, Watch, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { products } from "@/lib/data";
import { PageHeader } from "@/components/Avatar";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Tryumph Fit Gear" },
      { name: "description", content: "Official Tryumph Fit at-home workout gear." },
      { property: "og:title", content: "Shop — Tryumph Gym" },
      { property: "og:description", content: "Official Tryumph Fit home workout gear." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shop,
});

function Shop() {
  const all = products.filter((p) => !p.trainerId);
  const stores = [...new Set(all.map((p) => p.store))];
  return (
    <div>
      <PageHeader eyebrow="Coming soon" title="Shop" sub="Official Tryumph Fit gear for your home gym. Trainer merch lives on each coach's profile." />
      {stores.map((st) => (
        <section key={st} id={all.find((p) => p.store === st)?.trainerId || "tryumph"} className="mb-8 scroll-mt-24">
          <h2 className="mb-3 text-xl font-bold">{st}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {all.filter((p) => p.store === st).map((p) => (
              <div key={p.id} className="card p-5">
                <div className="grid aspect-square place-items-center rounded-xl bg-secondary"><ShoppingBag className="h-10 w-10 text-primary" /></div>
                <p className="mt-3 font-semibold">{p.name}</p>
                <div className="mt-2 flex items-center justify-between"><span>${p.price}</span><button className="btn btn-ghost" onClick={() => toast("Checkout opens soon — we'll notify you!")}>Notify me</button></div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card flex items-center gap-4 p-6"><Watch className="h-8 w-8 text-primary" /><div><p className="font-semibold">Fitness tracker sync</p><p className="text-sm text-muted-foreground">Coming soon</p></div></div>
        <div className="card flex items-center gap-4 p-6"><GraduationCap className="h-8 w-8 text-primary" /><div><p className="font-semibold">Homeschool fitness programs</p><p className="text-sm text-muted-foreground">Coming soon</p></div></div>
      </div>
    </div>
  );
}
