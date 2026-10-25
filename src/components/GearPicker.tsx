import { CATEGORIES, EQUIPMENT, LEVELS } from "@/lib/data";
import { useStore } from "@/lib/store";
import { ChoiceDropdown, MultiDropdown } from "@/components/WorkoutFilters";
import { SAFETY_OPTIONS } from "@/lib/workout-preferences";

/** Member picks the gear they own and health needs; recommendations use both. Saves instantly. */
export function GearPicker() {
  const { s, set, setExtra } = useStore();
  const gear = s.extra.gear ?? [];
  const conds = s.extra.conditions;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Workout preferences</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChoiceDropdown label="Level" value={s.profile.level} options={["All levels", ...LEVELS]} onChange={(level) => set((x) => ({ ...x, profile: { ...x.profile, level } }))} />
        <MultiDropdown label="Style" values={s.extra.styles ?? []} options={CATEGORIES} emptyLabel="All styles" onChange={(styles) => setExtra((x) => ({ ...x, styles }))} />
        <MultiDropdown label="Equipment I have at home" values={gear} options={EQUIPMENT} emptyLabel="Any equipment" exclusive="No equipment" onChange={(gear) => setExtra((x) => ({ ...x, gear }))} />
        <MultiDropdown label="Safety & comfort" values={[...conds.filter((n) => SAFETY_OPTIONS.includes(n)), ...(conds.includes("Pregnant") && !conds.includes("Pregnancy safe") ? ["Pregnancy safe"] : []), ...(s.extra.quiet && !conds.includes("Quiet / Apartment-friendly") ? ["Quiet / Apartment-friendly"] : [])]} options={SAFETY_OPTIONS} emptyLabel="No preferences" onChange={(values) => set((x) => ({ ...x, profile: { ...x.profile, postpartum: values.includes("Postpartum") }, extra: { ...x.extra, conditions: [...x.extra.conditions.filter((n) => !SAFETY_OPTIONS.includes(n) && n !== "Pregnant"), ...values, ...(values.includes("Pregnancy safe") ? ["Pregnant"] : [])], pregnant: values.includes("Pregnancy safe"), quiet: values.includes("Quiet / Apartment-friendly") } }))} />
      </div>
    </section>
  );
}
