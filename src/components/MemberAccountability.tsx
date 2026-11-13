import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";

export function MemberAccountability() {
  const { s, saveProfile } = useStore();
  const [goal, setGoal] = useState(s.extra.accountabilityGoal ?? "");
  const [workout, setWorkout] = useState("");
  const [busy, setBusy] = useState(false);
  const workouts = s.extra.selfReportedWorkouts ?? [];
  const saveGoal = async () => {
    setBusy(true);
    try {
      await saveProfile(x => ({ ...x, extra: { ...x.extra, accountabilityGoal: goal.trim().slice(0, 200) } }));
      toast.success("Goal saved");
    } catch { toast.error("Could not save your goal"); }
    finally { setBusy(false); }
  };
  const logWorkout = async () => {
    const title = workout.trim().slice(0, 120);
    if (!title || busy) return;
    setBusy(true);
    try {
      await saveProfile(x => ({ ...x, extra: { ...x.extra,
        selfReportedWorkouts: [...(x.extra.selfReportedWorkouts ?? []), { id: crypto.randomUUID(), title, at: new Date().toISOString() }].slice(-200)
      } }));
      setWorkout("");
      toast.success("Workout added to your personal log");
    } catch { toast.error("Could not save your workout"); }
    finally { setBusy(false); }
  };
  return <section className="card p-5 space-y-4" aria-label="Goals and workouts">
    <div><h2 className="text-lg font-semibold">Your goals & workouts</h2>
      <p className="text-sm text-muted-foreground">Showing up counts as an active day, even without a workout. Workouts below are self-reported and counted separately. Nothing here is shared with partners automatically.</p></div>
    <div className="space-y-2"><label htmlFor="accountability-goal" className="text-sm font-medium">My current goal</label>
      <div className="flex flex-wrap gap-2"><input id="accountability-goal" className="field flex-1" maxLength={200} value={goal} onChange={e => setGoal(e.target.value)} placeholder="E.g. Move three times this week" />
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void saveGoal()}>Save goal</button></div>
      <p className="text-xs text-muted-foreground">To share your goal, use the optional partner check-in in Trybes.</p></div>
    <div className="space-y-2"><p className="font-medium text-sm">Personal workout log · {workouts.length} recorded</p>
      <div className="flex flex-wrap gap-2"><input aria-label="Workout description" className="field flex-1" maxLength={120} value={workout} onChange={e => setWorkout(e.target.value)} placeholder="What workout did you finish?" />
        <button type="button" className="btn btn-primary" disabled={busy || !workout.trim()} onClick={() => void logWorkout()}>Log workout</button></div>
      <ul className="space-y-1 text-sm">{workouts.slice(-5).reverse().map(w => <li key={w.id}>{w.title} · {new Date(w.at).toLocaleDateString()}</li>)}</ul></div>
  </section>;
}
