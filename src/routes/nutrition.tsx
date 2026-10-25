import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import { useCloudMenu, useShares } from "@/lib/menus";
import { toast } from "sonner";
import { DAYS, SLOTS, meals, trainers, type Meal } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { MenuBoard, addToPlan, groceryList } from "@/components/MenuBoard";

export const Route = createFileRoute("/nutrition")({
  head: () => ({
    meta: [
      { title: "Nutrition & Weekly Menu — Tryumph Gym" },
      { name: "description", content: "Free meal ideas with macros, a weekly menu planner, and 1-on-1 nutritionists who can shape your plan." },
      { property: "og:title", content: "Nutrition & Weekly Menu — Tryumph Gym" },
      { property: "og:description", content: "Free recipes, a personal meal plan and nutritionist coaching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Nutrition,
});

function Nutrition() {
  const { s, setExtra } = useStore();
  const [picking, setPicking] = useState<Meal | null>(null);
  const [day, setDay] = useState<string>("Mon");
  const [slot, setSlot] = useState<string>("Dinner");
  const nutritionists = trainers.filter((t) => t.role === "Nutritionist");
  const myNutritionist = nutritionists.find((n) => s.bookings.some((b) => b.trainerId === n.id));
  const grocery = groceryList(s.extra.mealPlan);
  const me = useUserId();
  const { menu, loaded, save } = useCloudMenu(me);
  const { shares, reload: reloadShares } = useShares(me);
  const myShares = shares.filter((x) => x.client_id === me);
  const [code, setCode] = useState("");
  const synced = useRef(false);
  // First load: the cloud copy wins (a nutritionist may have edited it); otherwise upload this device's menu.
  useEffect(() => {
    if (!loaded || synced.current) return;
    synced.current = true;
    if (menu && Object.keys(menu.plan).length) setExtra((e) => ({ ...e, mealPlan: menu.plan, macroTarget: menu.target }));
    else save({ plan: s.extra.mealPlan, target: s.extra.macroTarget });
  }, [loaded]);
  useEffect(() => { if (synced.current && loaded) save({ plan: s.extra.mealPlan }); }, [s.extra.mealPlan]);
  const share = async () => {
    const { data, error } = await supabase.rpc("share_menu", { _code: code });
    if (error) { toast.error(error.message.includes("own") ? "That's your own code." : "We couldn't find a nutritionist with that code."); return; }
    toast.success(`${data} can now view and shape your menu`); setCode(""); void reloadShares();
  };
  const unshare = async (nid: string, name: string) => {
    await supabase.from("menu_shares").delete().eq("client_id", me!).eq("nutritionist_id", nid);
    toast(`${name} no longer has access`); void reloadShares();
  };

  const startAdd = (m: Meal) => {
    if (!s.signedIn) { toast("Sign in to save meals to your weekly menu."); return; }
    setPicking(m);
  };
  const confirmAdd = () => {
    if (!picking) return;
    const { tag: _t, ...meal } = picking;
    setExtra((e) => ({ ...e, mealPlan: addToPlan(e.mealPlan, day, slot, meal) }));
    toast.success(`Added to ${day} ${slot}`);
    setPicking(null);
  };

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Fuel" title="Nutrition" sub="Free meal ideas for everyone. Sign in to build your weekly menu." />
      <section>
        <h2 className="mb-4 text-2xl font-bold">Meal ideas</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {meals.map((m) => (
            <div key={m.title} className="card flex flex-col p-5">
              <span className="chip w-fit">{m.tag}</span>
              <p className="mt-3 font-display text-lg font-bold">{m.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.kcal} kcal · {m.protein}g protein · {m.carbs}g carbs · {m.fat}g fat</p>
              <p className="mt-2 flex-1 text-xs text-muted-foreground">{m.ingredients.join(", ")}</p>
              <button className="btn btn-ghost mt-4" onClick={() => startAdd(m)}>+ Add to meal plan</button>
            </div>
          ))}
        </div>
      </section>

      {picking && (
        <div className="card space-y-3 p-5">
          <p className="font-semibold">Add "{picking.title}" to…</p>
          <div className="flex flex-wrap gap-2">
            <select className="field w-auto" value={day} onChange={(e) => setDay(e.target.value)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select>
            <select className="field w-auto" value={slot} onChange={(e) => setSlot(e.target.value)}>{SLOTS.map((d) => <option key={d}>{d}</option>)}</select>
            <button className="btn btn-primary" onClick={confirmAdd}>Add</button>
            <button className="btn btn-ghost" onClick={() => setPicking(null)}>Cancel</button>
          </div>
        </div>
      )}

      {s.signedIn ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold">My weekly menu</h2>
            <div className="flex flex-wrap gap-2">
              {myNutritionist && <span className="chip chip-active">✓ {myNutritionist.name} can view & shape your menu</span>}
              {menu?.approved_by && <span className="chip chip-active">✓ Nutritionist Approved by {menu.approved_by}</span>}
            </div>
          </div>
          <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="flex-1">Share your menu with your nutritionist — ask them for their 8-character code.</span>
            <input className="field w-36 uppercase" placeholder="Code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-primary" disabled={code.trim().length < 8} onClick={share}>Share</button>
            {myShares.length > 0 && <div className="w-full flex flex-wrap gap-2">{myShares.map((x) => <span key={x.nutritionist_id} className="chip">{x.nutritionist_name} has access <button className="ml-2 text-muted-foreground underline" onClick={() => unshare(x.nutritionist_id, x.nutritionist_name)}>Remove</button></span>)}</div>}
          </div>
          <MenuBoard plan={s.extra.mealPlan} target={s.extra.macroTarget} onChange={(p) => setExtra((e) => ({ ...e, mealPlan: p }))} />
          <div className="card p-5">
            <p className="eyebrow">Grocery list for the week</p>
            {grocery.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Add meal ideas to see what to buy.</p> :
              <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">{grocery.map(([i, n]) => <li key={i}>☐ {i}{n > 1 ? ` ×${n}` : ""}</li>)}</ul>}
          </div>
        </section>
      ) : (
        <div className="card p-6 text-center"><p className="font-semibold">Want a weekly menu and grocery list?</p><Link to="/account" className="btn btn-primary mt-3">Create a free account</Link></div>
      )}

      <section>
        <h2 className="mb-2 text-2xl font-bold">Work with a nutritionist</h2>
        <p className="mb-4 text-sm text-muted-foreground">Book a 1-on-1 and your nutritionist gets access to your weekly menu to tailor it for you.</p>
        {nutritionists.map((t) => (
          <Link key={t.id} to="/trainers/$id" params={{ id: t.id }} className="card flex items-center gap-4 p-5 hover:border-primary">
            <Avatar initials={t.initials} />
            <div className="flex-1"><p className="font-semibold">{t.name}</p><p className="text-sm text-muted-foreground">{t.bio}</p></div>
            <span className="btn btn-primary">Book · ${t.rate}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
