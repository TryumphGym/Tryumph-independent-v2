import { PROGRAM_SAFETY, type FitnessProgram } from "@/lib/programs";
export function ProgramOutline({
  document,
  titles = {},
}: {
  document: FitnessProgram;
  titles?: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{PROGRAM_SAFETY}</p>
      {document.weeks.map((w, wi) => (
        <section key={w.id}>
          <h3 className="font-bold">
            Week {wi + 1}: {w.title}
          </h3>
          <ol className="space-y-2">
            {w.days.map((d, di) => (
              <li key={d.id} className="rounded border p-3">
                <strong>
                  Day {di + 1}: {d.title}
                  {d.rest ? " · Rest day" : ""}
                </strong>
                <p className="whitespace-pre-wrap text-sm">{d.instructions}</p>
                <ol>
                  {d.workouts.map((s, i) => (
                    <li key={s.id} className="mt-2 text-sm">
                      {i + 1}.{" "}
                      {s.title ??
                        (s.video_id
                          ? (titles[s.video_id] ?? "Approved workout")
                          : "Planned workout · unavailable")}
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {s.instructions}
                      </p>
                      {s.duration_seconds !== undefined && (
                        <p>Step timer: {s.duration_seconds} seconds</p>
                      )}
                      {s.exercises?.map((ex) => (
                        <div key={ex.id} className="ml-3">
                          <strong>{ex.label}</strong>
                          <p>{ex.description}</p>
                          <p>{ex.instructions}</p>
                          <p>
                            Equipment:{" "}
                            {(ex.equipment ?? []).join(", ") ||
                              "None specified"}
                          </p>
                          <p>{ex.safety_notes}</p>
                          {ex.variations?.map((v) => (
                            <p key={v.id}>
                              {v.label}: {v.instructions} {v.safety_notes}
                            </p>
                          ))}
                        </div>
                      ))}
                      {!!s.intervals?.length && (
                        <p>
                          Intervals:{" "}
                          {s.intervals
                            .map((p) => `${p.label} (${p.kind}, ${p.seconds}s)`)
                            .join(" → ")}
                        </p>
                      )}
                      {s.variations?.map((v) => (
                        <p key={v.id} className="ml-3 text-sm">
                          Variation: {v.label} — {v.instructions}
                        </p>
                      ))}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
