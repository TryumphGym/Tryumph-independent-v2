import { useCallback, useEffect, useRef, useState } from "react";
import { programPhase, type ProgramWorkout } from "@/lib/programs";
import {
  checkpointProgramStep,
  getProgramVideo,
  reportProgramUsage,
} from "@/lib/programs.functions";
import { useProgramClock, clockLabel } from "@/lib/use-program-clock";
import { OnDemandPlayer } from "./OnDemandPlayer";
export function ProgramStepPlayer({
  editionId,
  step,
  initialElapsed = 0,
  initialVariation,
  onClose,
  recordProgress = true,
}: {
  editionId: string;
  step: ProgramWorkout;
  initialElapsed?: number;
  initialVariation?: string | null;
  onClose: () => void;
  recordProgress?: boolean;
}) {
  const [variation, setVariation] = useState(
      initialVariation ??
        programPhase(step.intervals, initialElapsed)?.phase.exercise_id ??
        "",
    ),
    [media, setMedia] = useState<Awaited<
      ReturnType<typeof getProgramVideo>
    > | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [syncError, setSyncError] = useState(false),
    [retry, setRetry] = useState(0);
  const clock = useProgramClock(initialElapsed, step.duration_seconds ?? 0),
    clockRef = useRef(clock);
  clockRef.current = clock;
  const accessDenied = useRef(false);
  const usage = useRef<{ id: string; start: number } | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const phase = programPhase(step.intervals, clock.elapsed);
  const choices = [
    ...(step.variations ?? []),
    ...(step.exercises ?? []).flatMap((ex) => [ex, ...(ex.variations ?? [])]),
  ];
  const selected = choices.find((v) => v.id === variation);
  const selectionRef = useRef(variation);
  selectionRef.current = variation;
  const save = useCallback(
    async (selected = selectionRef.current) => {
      const elapsed = Math.floor(clockRef.current.current()),
        session = usage.current;
      try {
        if (recordProgress)
          await checkpointProgramStep({
            data: {
              editionId,
              stepId: step.id,
              elapsedSeconds: elapsed,
              ...(selected ? { variationId: selected } : {}),
            },
          });
        if (session)
          await reportProgramUsage({
            data: {
              id: session.id,
              seconds: Math.min(
                18000,
                Math.max(0, Math.floor(elapsed - session.start)),
              ),
            },
          });
        setSyncError(false);
      } catch (error) {
        if (
          error instanceof Error &&
          /Enrollment|access denied|Unauthorized/i.test(error.message)
        ) {
          accessDenied.current = true;
          clockRef.current.pause();
          setMedia(null);
          setError(
            "Program access is no longer available. Refresh your enrollment or contact support.",
          );
        }
        setSyncError(true);
      }
    },
    [editionId, step.id, recordProgress],
  );
  useEffect(() => {
    let active = true;
    accessDenied.current = false;
    setLoading(true);
    setError("");
    void getProgramVideo({
      data: {
        editionId,
        stepId: step.id,
        ...(variation ? { variationId: variation } : {}),
      },
    })
      .then((r) => {
        if (active && !accessDenied.current) {
          usage.current = r.usageId
            ? { id: r.usageId, start: clockRef.current.current() }
            : null;
          setImage(r.imageUrl ?? null);
          setMedia((old) =>
            old?.video.id === r.video.id && old.expiresAt > Date.now() + 60000
              ? { ...r, url: old.url, expiresAt: old.expiresAt }
              : r,
          );
        }
      })
      .catch((e) => {
        if (active) {
          clockRef.current.pause();
          setMedia(null);
          setError(
            e instanceof Error ? e.message : "Workout playback unavailable",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editionId, step.id, variation, retry]);
  useEffect(() => {
    const checkpoint = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", checkpoint);
    return () => document.removeEventListener("visibilitychange", checkpoint);
  }, [save]);
  const completedTimer = useRef(false);
  useEffect(() => {
    if (
      step.duration_seconds &&
      clock.elapsed >= step.duration_seconds &&
      !completedTimer.current
    ) {
      completedTimer.current = true;
      void save();
    }
  }, [clock.elapsed, step.duration_seconds, save]);
  const selectChoice = (id: string) => {
    void save(id);
    setImage(null);
    setVariation(id);
  };
  const phaseIndex = phase?.index ?? -1;
  const lastPhase = useRef(phaseIndex);
  useEffect(() => {
    if (phaseIndex !== lastPhase.current) {
      lastPhase.current = phaseIndex;
      void save();
      const exercise = step.intervals?.[phaseIndex]?.exercise_id;
      if (exercise) setVariation(exercise);
    }
  }, [phaseIndex, step.intervals, save]);
  useEffect(
    () => () => {
      void save();
    },
    [save],
  );
  // One refresh at credential expiry; timers and progress never poll the server.
  useEffect(() => {
    if (!media || clock.paused) return;
    const timer = window.setTimeout(
      () => {
        void save();
        setRetry((n) => n + 1);
      },
      Math.max(1000, media.expiresAt - Date.now() - 15000),
    );
    return () => window.clearTimeout(timer);
  }, [media, clock.paused, save]);
  const pause = useCallback(() => {
    clockRef.current.pause();
    void save();
  }, [save]);
  return (
    <section className="card space-y-3 p-4" aria-label="Workout step player">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold">{step.title ?? "Workout"} · step timer</h3>
          <p
            className="font-mono text-2xl"
            aria-live="off"
            data-testid="program-step-timer"
          >
            {clockLabel(clock.elapsed)}
            {step.duration_seconds
              ? ` / ${clockLabel(step.duration_seconds)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-outline"
            onClick={() => {
              if (clock.paused) clock.resume();
              else pause();
            }}
          >
            {clock.paused ? "Resume timer and video" : "Pause timer and video"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (
                window.confirm(
                  "Restart this step timer? Completed progress is not erased.",
                )
              ) {
                void save();
                usage.current = null;
                clock.reset();
                setRetry((n) => n + 1);
                void save();
              }
            }}
          >
            Restart timer
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clock.pause();
              void save().then(onClose);
            }}
          >
            Close workout
          </button>
        </div>
      </div>
      {phase && (
        <p role="status" className="rounded border p-3">
          <strong>
            {phase.phase.kind === "rest" ? "Rest / recovery" : "Work"} ·{" "}
            {phase.phase.label}
          </strong>{" "}
          · {clockLabel(phase.remaining)} remaining
        </p>
      )}
      {!!step.exercises?.length && (
        <label className="block">
          Exercise step
          <select
            className="field"
            aria-label="Exercise step"
            value={
              step.exercises.find(
                (ex) =>
                  ex.id === variation ||
                  ex.variations?.some((v) => v.id === variation),
              )?.id ?? ""
            }
            onChange={(e) => selectChoice(e.target.value)}
          >
            <option value="">Main follow-along workout</option>
            {step.exercises.map((ex, i) => (
              <option key={ex.id} value={ex.id}>
                {i + 1}. {ex.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {!!choices.length && (
        <label className="block">
          Choose an exercise variation
          <select
            className="field"
            aria-label="Exercise variation"
            value={variation}
            onChange={(e) => selectChoice(e.target.value)}
          >
            <option value="">Primary demonstration</option>
            {(step.variations ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
            {step.exercises?.map((ex) => (
              <optgroup key={ex.id} label={ex.label}>
                <option value={ex.id}>{ex.label} · primary</option>
                {ex.variations?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        The timer belongs to this step. Changing demonstrations preserves
        elapsed time and the original target duration. Playback seeks to that
        time when supported; short demonstrations loop without changing the
        workout duration.
      </p>
      {selected && (
        <aside className="space-y-2 rounded border p-3">
          <h4 className="font-bold">{selected.label}</h4>
          <p>{selected.description}</p>
          <p>
            Equipment:{" "}
            {(selected.equipment ?? []).filter(Boolean).join(", ") ||
              "None specified"}
          </p>
          <p className="whitespace-pre-wrap">{selected.instructions}</p>
          <p className="whitespace-pre-wrap text-sm">{selected.safety_notes}</p>
          {image && (
            <img
              src={image}
              alt={`${selected.label} demonstration`}
              className="max-h-72 max-w-full rounded object-contain"
            />
          )}
        </aside>
      )}
      {syncError && (
        <p className="text-sm" role="status">
          Timer progress has not synced.{" "}
          <button
            className="text-primary underline"
            onClick={() => void save()}
          >
            Retry saving
          </button>
        </p>
      )}
      {loading && <p role="status">Loading approved demonstration…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            className="text-primary underline"
            onClick={() => setRetry((n) => n + 1)}
          >
            Retry playback
          </button>
        </p>
      )}
      {media && (
        <OnDemandPlayer
          key={`${media.video.id}:${clock.resetVersion}`}
          video={media.video}
          initialUrl={media.url}
          synchronization={{
            elapsed: clock.elapsed,
            paused: clock.paused,
            onPlay: clock.resume,
            onPause: pause,
          }}
          onClose={() => {
            clock.pause();
            void save().then(onClose);
          }}
        />
      )}
      {step.duration_seconds !== undefined &&
        step.duration_seconds > 0 &&
        clock.elapsed >= step.duration_seconds && (
          <p role="status">
            Step timer complete. Review how you feel and mark the workout
            complete when ready.
          </p>
        )}
    </section>
  );
}
