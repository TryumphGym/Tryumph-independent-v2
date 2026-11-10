import { useState } from "react";
import { EVERYDAY_TRYUMPHS, EVERYDAY_SAFETY } from "@/lib/everyday-tryumphs";
export function EverydayTryumphs() {
  const [activity, setActivity] = useState("all"),
    [mobility, setMobility] = useState("all"),
    [time, setTime] = useState(2),
    [type, setType] = useState("all");
  const items = EVERYDAY_TRYUMPHS.filter(
    (x) =>
      (activity === "all" || x.activity === activity) &&
      (mobility === "all" || x.mobility === mobility) &&
      x.minutes <= time &&
      (type === "all" || x.type === type),
  );
  return (
    <section id="everyday-tryumphs" className="card my-6 space-y-4 p-6">
      <h2 className="text-2xl font-bold">Everyday Tryumphs</h2>
      <p>
        Fitness can happen in ordinary moments. Try a little movement if it
        feels right for you—there’s nothing to track or catch up on.
      </p>
      <details className="space-y-4">
        <summary className="cursor-pointer font-semibold">
          Browse small movement ideas
        </summary>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            Everyday activity
            <select
              className="field"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            >
              <option value="all">Any activity</option>
              {[...new Set(EVERYDAY_TRYUMPHS.map((x) => x.activity))].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Movement position
            <select
              className="field"
              value={mobility}
              onChange={(e) => setMobility(e.target.value)}
            >
              <option value="all">Any position</option>
              <option value="seated">Seated options</option>
              <option value="standing">Standing options</option>
            </select>
          </label>
          <label>
            Approximate time
            <select
              className="field"
              value={time}
              onChange={(e) => setTime(Number(e.target.value))}
            >
              <option value={1}>Up to 1 minute</option>
              <option value={2}>Up to 2 minutes</option>
            </select>
          </label>
          <label>
            Movement type
            <select
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">Any movement</option>
              {[...new Set(EVERYDAY_TRYUMPHS.map((x) => x.type))].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((x) => (
            <article key={x.id} className="rounded-xl border p-4">
              <p className="text-sm text-primary">
                {x.activity} · about {x.minutes} min · {x.mobility}
              </p>
              <h3 className="mt-1 font-bold">{x.title}</h3>
              <p className="mt-2 text-sm">{x.instructions}</p>
              <p className="mt-2 text-sm">
                <strong>Modification:</strong> {x.modification}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Suggested by Tryumph Gym
              </p>
            </article>
          ))}
        </div>
        {!items.length && (
          <p role="status">
            No suggestions match these choices. Try another activity or
            position.
          </p>
        )}
        <p className="text-xs text-muted-foreground">{EVERYDAY_SAFETY}</p>
      </details>
    </section>
  );
}
