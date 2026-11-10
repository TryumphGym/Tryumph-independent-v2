import { streak } from "@/lib/store";

const MARKS = [1, 7, 30, 100, 365, 500, 1000, 2000] as const;
export function ActiveMilestones({ days, role }: { days: string[]; role: "trainer" | "member" }) {
  const count = new Set(days).size;
  const run = streak(days);
  const achieved = MARKS.filter(n => count >= n);
  const latest = achieved.at(-1);
  const next = MARKS.find(n => n > count);
  return <section className="card p-5" aria-label="Your activity milestones">
    <h2 className="text-lg font-semibold">Your Tryumph milestones</h2>
    <p className="mt-1 text-sm text-muted-foreground">Active days are days you've used Tryumph while signed in, not completed workouts. Existing counts only include days previously recorded.</p>
    {latest && <p className="mt-3 font-semibold">🎉 Congratulations! You've been an active {role === "trainer" ? "trainer" : "member"} for {latest.toLocaleString()} recorded day{latest === 1 ? "" : "s"}!</p>}
    <div className="mt-3 flex flex-wrap gap-2 text-sm">
      <span className="chip">🏆 {count.toLocaleString()} active days</span>
      <span className="chip">🔥 {run} day streak</span>
      {next && <span className="chip">{next - count} more days until your {next.toLocaleString()}-day milestone</span>}
    </div>
  </section>;
}
