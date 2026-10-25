import { useEffect, useState } from "react";

// Values are always stored in metric (cm / kg); this only changes what people see and type.
export type Units = "us" | "metric";
const KEY = "tryumph-units";
const LB = 2.20462;

export function useUnits(): [Units, (u: Units) => void] {
  const [u, setU] = useState<Units>("us");
  useEffect(() => {
    const v = localStorage.getItem(KEY);
    if (v === "metric" || v === "us") setU(v);
  }, []);
  return [u, (n) => { localStorage.setItem(KEY, n); setU(n); window.dispatchEvent(new Event(KEY)); }];
}

export const toDisplayWeight = (kg: number, u: Units) => (u === "us" ? Math.round(kg * LB) : Math.round(kg * 10) / 10);
export const fromDisplayWeight = (v: number, u: Units) => (u === "us" ? v / LB : v);
export const weightLabel = (u: Units) => (u === "us" ? "lbs" : "kg");
export const fmtWeight = (kg: number, u: Units) => `${toDisplayWeight(kg, u)} ${weightLabel(u)}`;

export function UnitToggle({ units, onChange }: { units: Units; onChange: (u: Units) => void }) {
  return (
    <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => onChange(units === "us" ? "metric" : "us")}>
      {units === "us" ? "Use cm / kg instead" : "Use ft / lbs instead"}
    </button>
  );
}

export function HeightInput({ cm, units, onChange }: { cm: number; units: Units; onChange: (cm: number) => void }) {
  if (units === "metric")
    return <label className="text-sm">Height (cm)<input type="number" className="field mt-1" value={cm ? Math.round(cm) : ""} onChange={(e) => onChange(+e.target.value)} /></label>;
  const total = cm / 2.54;
  const ft = cm ? Math.floor(Math.round(total) / 12) : 0;
  const inch = cm ? Math.round(total) - ft * 12 : 0;
  const upd = (f: number, i: number) => onChange((f * 12 + i) * 2.54);
  return (
    <div className="text-sm">Height
      <div className="mt-1 flex gap-2">
        <input type="number" aria-label="Feet" placeholder="ft" className="field" value={ft || ""} onChange={(e) => upd(+e.target.value, inch)} />
        <input type="number" aria-label="Inches" placeholder="in" className="field" value={cm ? inch : ""} onChange={(e) => upd(ft, +e.target.value)} />
      </div>
    </div>
  );
}

export function WeightInput({ kg, units, onChange }: { kg: number; units: Units; onChange: (kg: number) => void }) {
  return <label className="text-sm">Weight ({weightLabel(units)})<input type="number" className="field mt-1" value={kg ? toDisplayWeight(kg, units) : ""} onChange={(e) => onChange(fromDisplayWeight(+e.target.value, units))} /></label>;
}
