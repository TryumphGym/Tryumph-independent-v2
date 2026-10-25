import { useState } from "react";
import { MessageSquareText, Plus, Trash2 } from "lucide-react";
import { DAYS, SLOTS } from "@/lib/data";
import type { MealPlan, PlanMeal } from "@/lib/store";

const id = () => Math.random().toString(36).slice(2, 9);

export function dayTotals(plan: MealPlan, day: string) {
  const meals = SLOTS.flatMap((sl) => plan[day]?.[sl] ?? []);
  return meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function addToPlan(plan: MealPlan, day: string, slot: string, meal: Omit<PlanMeal, "id">): MealPlan {
  const d = plan[day] ?? {};
  return { ...plan, [day]: { ...d, [slot]: [...(d[slot] ?? []), { ...meal, id: id() }] } };
}

/** Editable 7-day menu. `editor` is the name shown on notes/meals added (e.g. a nutritionist). */
export function MenuBoard({ plan, target, onChange, editor }: { plan: MealPlan; target: { kcal: number; protein: number }; onChange: (p: MealPlan) => void; editor?: string }) {
  const [day, setDay] = useState<string>(DAYS[0]);
  const [custom, setCustom] = useState({ slot: "Snacks", title: "", kcal: "", protein: "", carbs: "", fat: "" });
  const t = dayTotals(plan, day);
  const pct = (a: number, b: number) => Math.min(100, Math.round((a / Math.max(1, b)) * 100));

  const remove = (slot: string, mid: string) => onChange({ ...plan, [day]: { ...plan[day], [slot]: (plan[day]?.[slot] ?? []).filter((m) => m.id !== mid) } });
  const note = (slot: string, mid: string) => {
    const n = window.prompt("Coaching note for this meal");
    if (!n) return;
    onChange({ ...plan, [day]: { ...plan[day], [slot]: (plan[day]?.[slot] ?? []).map((m) => (m.id === mid ? { ...m, note: n, by: editor } : m)) } });
  };
  const addCustom = () => {
    if (!custom.title.trim()) return;
    onChange(addToPlan(plan, day, custom.slot, { title: custom.title, kcal: +custom.kcal || 0, protein: +custom.protein || 0, carbs: +custom.carbs || 0, fat: +custom.fat || 0, by: editor }));
    setCustom({ ...custom, title: "", kcal: "", protein: "", carbs: "", fat: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{DAYS.map((d) => <button key={d} onClick={() => setDay(d)} className={`chip ${day === d ? "chip-active" : ""}`}>{d}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[["Calories", t.kcal, target.kcal, "kcal"], ["Protein", t.protein, target.protein, "g"]].map(([l, v, g, u]) => (
          <div key={l as string} className="card p-4">
            <div className="flex justify-between text-sm"><span>{l}</span><span className="text-muted-foreground">{v} / {g} {u}</span></div>
            <div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct(v as number, g as number)}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Carbs {t.carbs}g · Fat {t.fat}g</p>
      <div className="grid gap-3 md:grid-cols-2">
        {SLOTS.map((sl) => (
          <div key={sl} className="card p-4">
            <p className="eyebrow">{sl}</p>
            {(plan[day]?.[sl] ?? []).length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing planned.</p>}
            {(plan[day]?.[sl] ?? []).map((m) => (
              <div key={m.id} className="mt-2 rounded-lg bg-secondary p-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="flex-1"><p className="font-semibold">{m.title}</p><p className="text-xs text-muted-foreground">{m.kcal} kcal · {m.protein}g P{m.by ? ` · added by ${m.by}` : ""}</p></div>
                  {editor && <button aria-label="Add note" onClick={() => note(sl, m.id)} className="text-primary"><MessageSquareText className="h-4 w-4" /></button>}
                  <button aria-label="Remove" onClick={() => remove(sl, m.id)} className="text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                </div>
                {m.note && <p className="mt-2 text-xs text-accent">💬 {m.by ?? "Note"}: {m.note}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="card grid gap-2 p-4 sm:grid-cols-7">
        <select className="field sm:col-span-1" value={custom.slot} onChange={(e) => setCustom({ ...custom, slot: e.target.value })}>{SLOTS.map((x) => <option key={x}>{x}</option>)}</select>
        <input className="field sm:col-span-2" placeholder="Custom meal or leftovers" value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} />
        {(["kcal", "protein", "carbs", "fat"] as const).map((k) => <input key={k} type="number" className="field" placeholder={k} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} />)}
        <button className="btn btn-primary sm:col-span-7" onClick={addCustom}><Plus className="h-4 w-4" />Add to {day}</button>
      </div>
    </div>
  );
}

export function groceryList(plan: MealPlan) {
  const counts: Record<string, number> = {};
  Object.values(plan).forEach((d) => Object.values(d).forEach((ms) => ms.forEach((m) => (m.ingredients ?? []).forEach((i) => { counts[i] = (counts[i] ?? 0) + 1; }))));
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
}
