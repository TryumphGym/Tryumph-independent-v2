import type {
  ProgramVariation,
  ProgramExercise,
  ProgramInterval,
} from "@/lib/programs";
import { moveProgramItem } from "@/lib/programs";
import type { Tables } from "@/integrations/supabase/types";
import { PrivateVideoPreview } from "./PrivateVideoPreview";
import { ProgramImagePreview } from "./ProgramImagePreview";
type Library = {
  videos: Pick<Tables<"trainer_videos">, "id" | "title">[];
  images: Tables<"program_images">[];
};
function DemoEditor({
  value,
  onChange,
  videos,
  images,
  label = "Variation",
}: Library & {
  value: ProgramVariation;
  onChange: (v: ProgramVariation) => void;
  label?: string;
}) {
  const updateOptional = (key: "video_id" | "image_id", id: string) => {
    const next = { ...value };
    if (id) next[key] = id;
    else delete next[key];
    onChange(next);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label>
        {label} name
        <input
          className="field"
          maxLength={80}
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
        />
      </label>
      <label>
        Equipment (comma separated)
        <input
          className="field"
          value={(value.equipment ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              equipment: e.target.value.split(",").map((s) => s.trim()),
            })
          }
        />
      </label>
      <label className="sm:col-span-2">
        Description
        <textarea
          className="field"
          maxLength={2000}
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </label>
      <label>
        Approved demonstration video
        <select
          className="field"
          value={value.video_id ?? ""}
          onChange={(e) => updateOptional("video_id", e.target.value)}
        >
          <option value="">Use the main follow-along video</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Private demonstration image
        <select
          className="field"
          value={value.image_id ?? ""}
          onChange={(e) => updateOptional("image_id", e.target.value)}
        >
          <option value="">No image</option>
          {images.map((i) => (
            <option key={i.id} value={i.id}>
              {i.object_path.split("/").at(-1)} · {i.review_status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Trainer instructions
        <textarea
          className="field"
          maxLength={2000}
          value={value.instructions}
          onChange={(e) => onChange({ ...value, instructions: e.target.value })}
        />
      </label>
      <label>
        Safety notes
        <textarea
          className="field"
          maxLength={2000}
          value={value.safety_notes ?? ""}
          onChange={(e) => onChange({ ...value, safety_notes: e.target.value })}
        />
      </label>
      {value.video_id && <PrivateVideoPreview id={value.video_id} />}{" "}
      {value.image_id && <ProgramImagePreview id={value.image_id} />}
    </div>
  );
}
export function ExerciseVariationsEditor({
  variations,
  onChange,
  videos,
  images,
}: Library & {
  variations: ProgramVariation[];
  onChange: (v: ProgramVariation[]) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend>Exercise variations</legend>
      <p className="text-xs">
        Optional demonstrations reuse approved media. Labels such as
        baby-holding do not establish medical safety; provide relevant
        individual guidance.
      </p>
      {variations.map((v, i) => (
        <section key={v.id} className="space-y-2 rounded border p-3">
          <DemoEditor
            value={v}
            onChange={(next) =>
              onChange(variations.map((old, j) => (i === j ? next : old)))
            }
            videos={videos}
            images={images}
          />
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              type="button"
              aria-label={`Move variation ${i + 1} up`}
              disabled={!i}
              onClick={() => onChange(moveProgramItem(variations, i, -1))}
            >
              ↑
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={i === variations.length - 1}
              aria-label={`Move variation ${i + 1} down`}
              onClick={() => onChange(moveProgramItem(variations, i, 1))}
            >
              ↓
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => onChange(variations.filter((_, j) => i !== j))}
            >
              Remove variation
            </button>
          </div>
        </section>
      ))}
      <button
        className="btn btn-outline"
        type="button"
        disabled={variations.length >= 6}
        onClick={() =>
          onChange([
            ...variations,
            {
              id: crypto.randomUUID(),
              label: `Variation ${variations.length + 1}`,
              instructions: "",
            },
          ])
        }
      >
        Add variation
      </button>
    </fieldset>
  );
}
export function ProgramExercisesEditor({
  exercises,
  onChange,
  videos,
  images,
}: Library & {
  exercises: ProgramExercise[];
  onChange: (v: ProgramExercise[]) => void;
}) {
  return (
    <section className="space-y-3">
      <h4 className="font-bold">Exercise steps within this workout</h4>
      {exercises.map((ex, i) => (
        <section key={ex.id} className="space-y-3 rounded border p-3">
          <DemoEditor
            label="Exercise"
            value={ex}
            videos={videos}
            images={images}
            onChange={(next) =>
              onChange(
                exercises.map((old, j) =>
                  i === j ? { ...old, ...next } : old,
                ),
              )
            }
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!i}
              aria-label={`Move exercise ${i + 1} up`}
              onClick={() => onChange(moveProgramItem(exercises, i, -1))}
            >
              ↑
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={i === exercises.length - 1}
              aria-label={`Move exercise ${i + 1} down`}
              onClick={() => onChange(moveProgramItem(exercises, i, 1))}
            >
              ↓
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => onChange(exercises.filter((_, j) => j !== i))}
            >
              Remove exercise
            </button>
          </div>
          <ExerciseVariationsEditor
            videos={videos}
            images={images}
            variations={ex.variations ?? []}
            onChange={(variants) =>
              onChange(
                exercises.map((old, j) =>
                  j === i ? { ...old, variations: variants } : old,
                ),
              )
            }
          />
        </section>
      ))}
      <button
        className="btn btn-outline"
        type="button"
        disabled={exercises.length >= 40}
        onClick={() =>
          onChange([
            ...exercises,
            {
              id: crypto.randomUUID(),
              label: `Exercise ${exercises.length + 1}`,
              instructions: "",
              variations: [],
            },
          ])
        }
      >
        Add exercise step
      </button>
    </section>
  );
}
export function ProgramIntervalsEditor({
  intervals,
  exercises,
  onChange,
}: {
  intervals: ProgramInterval[];
  exercises: ProgramExercise[];
  onChange: (v: ProgramInterval[]) => void;
}) {
  const update = (i: number, v: ProgramInterval) =>
    onChange(intervals.map((old, j) => (i === j ? v : old)));
  return (
    <section className="space-y-2 rounded border p-3">
      <h4 className="font-bold">Optional work / rest intervals</h4>
      <p className="text-xs">
        Intervals determine the workout timer duration. They run entirely on the
        member’s device.
      </p>
      {intervals.map((p, i) => (
        <div key={p.id} className="grid items-end gap-2 sm:grid-cols-5">
          <label>
            Interval label
            <input
              className="field"
              value={p.label}
              maxLength={80}
              onChange={(e) => update(i, { ...p, label: e.target.value })}
            />
          </label>
          <label>
            Type
            <select
              className="field"
              value={p.kind}
              onChange={(e) =>
                update(i, { ...p, kind: e.target.value as "work" | "rest" })
              }
            >
              <option value="work">Work</option>
              <option value="rest">Rest / recovery</option>
            </select>
          </label>
          <label>
            Seconds
            <input
              className="field"
              type="number"
              min={1}
              max={3600}
              value={p.seconds}
              onChange={(e) =>
                update(i, { ...p, seconds: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Exercise
            <select
              className="field"
              value={p.exercise_id ?? ""}
              onChange={(e) => {
                const next = { ...p };
                if (e.target.value) next.exercise_id = e.target.value;
                else delete next.exercise_id;
                update(i, next);
              }}
            >
              <option value="">Follow-along / none</option>
              {exercises.map((ex) => (
                <option value={ex.id} key={ex.id}>
                  {ex.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-1">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!i}
              aria-label={`Move interval ${i + 1} up`}
              onClick={() => onChange(moveProgramItem(intervals, i, -1))}
            >
              ↑
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={i === intervals.length - 1}
              aria-label={`Move interval ${i + 1} down`}
              onClick={() => onChange(moveProgramItem(intervals, i, 1))}
            >
              ↓
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => onChange(intervals.filter((_, j) => i !== j))}
            >
              ×
            </button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          className="btn btn-outline"
          type="button"
          disabled={intervals.length >= 50}
          onClick={() =>
            onChange([
              ...intervals,
              {
                id: crypto.randomUUID(),
                label: "Work",
                kind: "work",
                seconds: 30,
              },
            ])
          }
        >
          Add work interval
        </button>
        <button
          className="btn btn-outline"
          type="button"
          disabled={intervals.length >= 50}
          onClick={() =>
            onChange([
              ...intervals,
              {
                id: crypto.randomUUID(),
                label: "Recovery",
                kind: "rest",
                seconds: 15,
              },
            ])
          }
        >
          Add rest interval
        </button>
      </div>
    </section>
  );
}
