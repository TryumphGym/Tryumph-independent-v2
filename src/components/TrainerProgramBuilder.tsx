import { ProgramDownloadEditor } from "./ProgramDownloads";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import {
  newProgram,
  newProgramDay,
  moveProgramItem,
  programDraftSchema,
  PROGRAM_SAFETY,
  type FitnessProgram,
  type ProgramDay,
} from "@/lib/programs";
import {
  saveFitnessProgram,
  submitFitnessProgram,
  setFitnessProgramVisibility,
  getTrainerProgramMetrics,
  registerProgramImage,
} from "@/lib/programs.functions";
import type { Tables } from "@/integrations/supabase/types";
import { PrivateVideoPreview } from "./PrivateVideoPreview";
import { ProgramOutline } from "./ProgramOutline";
import {
  ExerciseVariationsEditor,
  ProgramExercisesEditor,
  ProgramIntervalsEditor,
} from "./ProgramExerciseEditors";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Program action failed";
const money = (n: number) => `$${(n / 100).toFixed(2)}`;
export function TrainerProgramBuilder() {
  const me = useUserId();
  return <ProgramBuilderForViewer key={me ?? "signed-out"} me={me} />;
}
function ProgramBuilderForViewer({ me }: { me: string | null }) {
  const [programs, setPrograms] = useState<Tables<"trainer_programs">[]>([]),
    [editions, setEditions] = useState<Tables<"program_editions">[]>([]);
  const [videos, setVideos] = useState<
      Pick<
        Tables<"trainer_videos">,
        "id" | "title" | "minutes" | "access_scope"
      >[]
    >([]),
    [doc, setDoc] = useState<FitnessProgram>(newProgram),
    [selected, setSelected] = useState<string | undefined>();
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [dirty, setDirty] = useState(false);
  const [metrics, setMetrics] = useState<
    Awaited<ReturnType<typeof getTrainerProgramMetrics>>
  >({});
  const [images, setImages] = useState<Tables<"program_images">[]>([]);
  const viewer = useRef(me);
  viewer.current = me;
  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    setError("");
    try {
      const [p, v, m, im] = await Promise.all([
        supabase
          .from("trainer_programs")
          .select("*")
          .eq("trainer_id", me)
          .eq("builder_version", 2)
          .order("created_at", { ascending: false }),
        supabase
          .from("trainer_videos")
          .select("id,title,minutes,access_scope")
          .eq("user_id", me)
          .eq("review_status", "approved")
          .like("path", "bunny:%")
          .not("category", "ilike", "%youth%")
          .not("category", "ilike", "%homeschool%")
          .not("category", "ilike", "%nutrition%"),
        getTrainerProgramMetrics(),
        supabase
          .from("program_images")
          .select("*")
          .eq("trainer_id", me)
          .order("created_at", { ascending: false }),
      ]);
      if (viewer.current !== me) return;
      if (p.error || v.error || im.error)
        throw new Error(
          p.error?.message ?? v.error?.message ?? im.error?.message,
        );
      setPrograms(p.data ?? []);
      setVideos(v.data ?? []);
      setImages(im.data ?? []);
      setMetrics(m);
    } catch (e) {
      if (viewer.current !== me) return;
      setError(errorText(e));
    } finally {
      if (viewer.current === me) setLoading(false);
    }
  }, [me]);
  useEffect(() => {
    setPrograms([]);
    setVideos([]);
    setImages([]);
    setMetrics({});
    setDoc(newProgram());
    setEditions([]);
    setSelected(undefined);
    setDirty(false);
    void load();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const change = (next: FitnessProgram) => {
    setDoc(next);
    setDirty(true);
  };
  const open = async (id?: string) => {
    if (dirty && !window.confirm("Discard unsaved program changes?")) return;
    if (!id) {
      setSelected(undefined);
      setDoc(newProgram());
      setEditions([]);
      setDirty(false);
      return;
    }
    setBusy(true);
    try {
      const [d, e] = await Promise.all([
        supabase
          .from("program_drafts")
          .select("document")
          .eq("program_id", id)
          .single(),
        supabase
          .from("program_editions")
          .select("*")
          .eq("program_id", id)
          .order("version", { ascending: false }),
      ]);
      if (viewer.current !== me) return;
      if (d.error || e.error)
        throw new Error(d.error?.message ?? e.error?.message);
      const parsed = programDraftSchema.parse(d.data.document);
      setDoc(parsed);
      setSelected(id);
      setEditions(e.data);
      setDirty(false);
      setPreview(false);
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async (submit = false) => {
    setBusy(true);
    try {
      const id = await saveFitnessProgram({
        data: { ...(selected ? { id: selected } : {}), document: doc },
      });
      setSelected(id);
      setDirty(false);
      if (submit) {
        await submitFitnessProgram({ data: { id } });
        toast.success(
          "Immutable edition submitted for independent admin review",
        );
        const e = await supabase
          .from("program_editions")
          .select("*")
          .eq("program_id", id)
          .order("version", { ascending: false });
        if (e.error) throw e.error;
        setEditions(e.data);
      } else toast.success("Draft saved");
      await load();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const dayChange = (wi: number, di: number, day: ProgramDay) =>
    change({
      ...doc,
      weeks: doc.weeks.map((w, i) =>
        i !== wi
          ? w
          : { ...w, days: w.days.map((d, j) => (j === di ? day : d)) },
      ),
    });
  const uploadCover = async (file?: File) => {
    if (!file || !me) return;
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return void toast.error("Use JPEG, PNG or WebP up to 5 MB");
    setBusy(true);
    try {
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const path = `${me}/${crypto.randomUUID()}.${ext}`;
      const r = await supabase.storage
        .from("trainer-store-images")
        .upload(path, file, { contentType: file.type });
      if (r.error) throw r.error;
      change({
        ...doc,
        cover_url: supabase.storage
          .from("trainer-store-images")
          .getPublicUrl(path).data.publicUrl,
      });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5">
      <div className="card p-6">
        <h2 className="text-2xl font-bold">Workout program builder</h2>
        <p className="text-sm text-muted-foreground">
          Create structured weeks from your approved Bunny library. New editions
          are independently reviewed. Existing members keep the edition they
          enrolled in, including after unpublishing.
        </p>
        <Link className="text-primary underline" to="/programs">
          Browse programs
        </Link>
      </div>
      {loading && <p role="status">Loading your programs…</p>}
      {error && (
        <p role="alert" className="card p-4">
          {error}{" "}
          <button className="btn btn-ghost" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-outline"
          disabled={busy}
          onClick={() => void open()}
        >
          New program
        </button>
        {programs.map((p) => (
          <button
            key={p.id}
            className={`chip ${p.id === selected ? "chip-active" : ""}`}
            disabled={busy}
            onClick={() => void open(p.id)}
          >
            {p.title} ·{" "}
            {p.blocked
              ? "Moderated"
              : p.published
                ? "Published"
                : "Draft / unpublished"}
          </button>
        ))}
      </div>
      {selected && (
        <section
          className="card flex flex-wrap gap-5 p-4"
          aria-label="Program metrics"
        >
          <span>Active enrollments: {metrics[selected]?.enrollments ?? 0}</span>
          <span>Verified sales: {metrics[selected]?.sales ?? 0}</span>
          <span>Gross: {money(metrics[selected]?.gross ?? 0)}</span>
          <span>Refunded: {money(metrics[selected]?.refunded ?? 0)}</span>
          <span>Actual fees: {money(metrics[selected]?.fees ?? 0)}</span>
          <span>
            Transferred less reversals:{" "}
            {money(metrics[selected]?.transferred ?? 0)}
          </span>
        </section>
      )}
      <form
        className="card space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              Title
              <input
                className="field"
                required
                maxLength={160}
                value={doc.title}
                onChange={(e) => change({ ...doc, title: e.target.value })}
              />
            </label>
            <label>
              Category
              <input
                className="field"
                required
                maxLength={80}
                value={doc.category}
                onChange={(e) => change({ ...doc, category: e.target.value })}
              />
            </label>
          </div>
          <label className="block">
            Intensity
            <select
              className="field"
              value={doc.intensity}
              onChange={(e) =>
                change({
                  ...doc,
                  intensity: e.target.value as typeof doc.intensity,
                })
              }
            >
              <option value="">Not assessed</option>
              {["gentle", "moderate", "challenging"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Product type
            <select
              className="field"
              value={doc.product_type}
              onChange={(e) =>
                change({
                  ...doc,
                  product_type: e.target
                    .value as FitnessProgram["product_type"],
                })
              }
            >
              {[
                ["workout_program", "Workout program"],
                ["video_course", "Video course"],
                ["challenge", "Fitness challenge"],
                ["download", "Downloadable guide"],
              ].map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <DiscoveryFilters
            value={doc.discovery_tags}
            onChange={(discovery_tags) => change({ ...doc, discovery_tags })}
            editor
          />
          <ProgramDownloadEditor
            value={doc.downloads}
            onChange={(downloads) => change({ ...doc, downloads })}
          />
          <label className="block">
            Description
            <textarea
              className="field"
              maxLength={4000}
              value={doc.description}
              onChange={(e) => change({ ...doc, description: e.target.value })}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              Cover image URL
              <input
                className="field"
                type="url"
                value={doc.cover_url}
                onChange={(e) => change({ ...doc, cover_url: e.target.value })}
              />
            </label>
            <label>
              Upload cover (up to 5 MB)
              <input
                className="field"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void uploadCover(e.target.files?.[0])}
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              Difficulty
              <select
                className="field"
                value={doc.difficulty}
                onChange={(e) =>
                  change({
                    ...doc,
                    difficulty: e.target.value as FitnessProgram["difficulty"],
                  })
                }
              >
                {["Beginner", "Intermediate", "Advanced", "All levels"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Goals (comma separated)
              <input
                className="field"
                value={doc.goals.join(", ")}
                onChange={(e) =>
                  change({
                    ...doc,
                    goals: e.target.value.split(",").map((v) => v.trim()),
                  })
                }
              />
            </label>
            <label>
              Equipment (comma separated)
              <input
                className="field"
                value={doc.equipment.join(", ")}
                onChange={(e) =>
                  change({
                    ...doc,
                    equipment: e.target.value.split(",").map((v) => v.trim()),
                  })
                }
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(["pregnancy", "postpartum"] as const).map((key) => (
              <label key={key}>
                {key === "pregnancy" ? "Pregnancy" : "Postpartum"} suitability
                <select
                  className="field"
                  value={doc[key]}
                  onChange={(e) => change({ ...doc, [key]: e.target.value })}
                >
                  <option value="not_assessed">Not assessed</option>
                  <option value="trainer_labeled">
                    Trainer-labeled modifications available
                  </option>
                  <option value="not_suitable">Not suitable</option>
                </select>
              </label>
            ))}
          </div>
          <label className="block">
            Suitability notes
            <textarea
              className="field"
              maxLength={2000}
              value={doc.suitability_notes}
              onChange={(e) =>
                change({ ...doc, suitability_notes: e.target.value })
              }
            />
          </label>
          <p className="text-sm text-muted-foreground">{PROGRAM_SAFETY}</p>
          <div className="grid gap-4 md:grid-cols-3">
            <label>
              Purchase access period
              <select
                className="field"
                value={doc.access_period}
                onChange={(e) =>
                  change({
                    ...doc,
                    access_period: e.target
                      .value as FitnessProgram["access_period"],
                  })
                }
              >
                <option value="30">30 days from confirmation</option>
                <option value="90">90 days from confirmation</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </label>
            <label>
              Program access
              <select
                className="field"
                value={doc.mode}
                onChange={(e) =>
                  change({
                    ...doc,
                    mode: e.target.value as FitnessProgram["mode"],
                    price_cents: 0,
                  })
                }
              >
                <option value="free">Free enrollment</option>
                <option value="native">Native one-time purchase</option>
                <option value="members">
                  Members Only — included subscription
                </option>
                <option value="external">External storefront purchase</option>
              </select>
            </label>
            {doc.mode !== "free" && doc.mode !== "members" && (
              <label>
                Price (USD)
                <input
                  className="field"
                  type="number"
                  min={doc.mode === "native" ? 0.5 : 0}
                  max={10000}
                  step="0.01"
                  value={doc.price_cents / 100}
                  onChange={(e) =>
                    change({
                      ...doc,
                      price_cents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                />
              </label>
            )}
            {doc.mode === "external" && (
              <label>
                External purchase URL
                <input
                  className="field"
                  type="url"
                  required
                  value={doc.external_url}
                  onChange={(e) =>
                    change({ ...doc, external_url: e.target.value })
                  }
                />
              </label>
            )}
          </div>
          {doc.mode === "native" && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={doc.subscription_access}
                onChange={(e) =>
                  change({ ...doc, subscription_access: e.target.checked })
                }
              />
              Also include this edition with an active subscription to me
            </label>
          )}
          {doc.mode === "members" && (
            <p>
              Requires an active subscription to this trainer. Access expires
              with the paid period; progress is preserved. Use approved
              protected-library media.
            </p>
          )}
          {doc.mode === "native" && (
            <p className="rounded border p-3 text-sm">
              Native sales default to 90% trainer / 10% Tryumph after actual
              payment fees, before hosting costs. Checkout stays disabled until
              the owner completes payment and delivery setup. Public-library
              videos remain free outside the program; use newly uploaded
              protected-library videos for exclusive content.
            </p>
          )}
          {doc.mode === "external" && (
            <p className="text-sm">
              The trainer keeps 100% of external earnings. Tryumph does not
              process this payment. Following a seller link does not unlock
              content; external access requires an admin’s independent receipt
              review.
            </p>
          )}
          <h3 className="text-xl font-bold">
            Schedule · {doc.weeks.length}{" "}
            {doc.weeks.length === 1 ? "week" : "weeks"}
          </h3>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Edit schedule" : "Preview schedule"}
          </button>
          {preview ? (
            <ProgramOutline
              document={doc}
              titles={Object.fromEntries(videos.map((v) => [v.id, v.title]))}
            />
          ) : (
            doc.weeks.map((w, wi) => (
              <section key={w.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap gap-2">
                  <label className="flex-1">
                    Week title
                    <input
                      className="field"
                      maxLength={160}
                      value={w.title}
                      onChange={(e) =>
                        change({
                          ...doc,
                          weeks: doc.weeks.map((old, i) =>
                            i === wi ? { ...old, title: e.target.value } : old,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`Move week ${wi + 1} up`}
                    disabled={wi === 0}
                    onClick={() =>
                      change({
                        ...doc,
                        weeks: moveProgramItem(doc.weeks, wi, -1),
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`Move week ${wi + 1} down`}
                    disabled={wi === doc.weeks.length - 1}
                    onClick={() =>
                      change({
                        ...doc,
                        weeks: moveProgramItem(doc.weeks, wi, 1),
                      })
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={doc.weeks.length === 1}
                    onClick={() =>
                      change({
                        ...doc,
                        weeks: doc.weeks.filter((_, i) => i !== wi),
                      })
                    }
                  >
                    Remove week
                  </button>
                </div>
                {w.days.map((d, di) => (
                  <div
                    key={d.id}
                    className="space-y-2 rounded bg-secondary/40 p-3"
                  >
                    <div className="flex flex-wrap gap-2">
                      <label className="flex-1">
                        Day {di + 1} title
                        <input
                          className="field"
                          maxLength={160}
                          value={d.title}
                          onChange={(e) =>
                            dayChange(wi, di, { ...d, title: e.target.value })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Move day ${di + 1} up`}
                        disabled={di === 0}
                        onClick={() =>
                          change({
                            ...doc,
                            weeks: doc.weeks.map((old, i) =>
                              i === wi
                                ? {
                                    ...old,
                                    days: moveProgramItem(w.days, di, -1),
                                  }
                                : old,
                            ),
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Move day ${di + 1} down`}
                        disabled={di === w.days.length - 1}
                        onClick={() =>
                          change({
                            ...doc,
                            weeks: doc.weeks.map((old, i) =>
                              i === wi
                                ? {
                                    ...old,
                                    days: moveProgramItem(w.days, di, 1),
                                  }
                                : old,
                            ),
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={w.days.length === 1}
                        onClick={() =>
                          change({
                            ...doc,
                            weeks: doc.weeks.map((old, i) =>
                              i === wi
                                ? {
                                    ...old,
                                    days: old.days.filter((_, j) => j !== di),
                                  }
                                : old,
                            ),
                          })
                        }
                      >
                        Remove day
                      </button>
                    </div>
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={d.rest}
                        onChange={(e) => {
                          if (
                            e.target.checked &&
                            d.workouts.length &&
                            !window.confirm(
                              "Remove workouts and make this a rest day?",
                            )
                          )
                            return;
                          dayChange(wi, di, {
                            ...d,
                            rest: e.target.checked,
                            workouts: e.target.checked ? [] : d.workouts,
                          });
                        }}
                      />
                      Rest day
                    </label>
                    <label className="block">
                      Day instructions
                      <textarea
                        className="field"
                        maxLength={4000}
                        value={d.instructions}
                        onChange={(e) =>
                          dayChange(wi, di, {
                            ...d,
                            instructions: e.target.value,
                          })
                        }
                      />
                    </label>
                    {!d.rest && (
                      <>
                        <label className="block">
                          Add an approved Bunny workout
                          <select
                            className="field"
                            value=""
                            disabled={d.workouts.length >= 20}
                            onChange={(e) => {
                              if (e.target.value)
                                dayChange(wi, di, {
                                  ...d,
                                  workouts: [
                                    ...d.workouts,
                                    {
                                      id: crypto.randomUUID(),
                                      video_id: e.target.value,
                                      instructions: "",
                                    },
                                  ],
                                });
                            }}
                          >
                            <option value="">
                              Choose from your approved library
                            </option>
                            {videos.map((v) => (
                              <option value={v.id} key={v.id}>
                                {v.title} · {v.minutes} min ·{" "}
                                {v.access_scope === "program"
                                  ? "Protected"
                                  : "Free public"}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={d.workouts.length >= 20}
                          onClick={() =>
                            dayChange(wi, di, {
                              ...d,
                              workouts: [
                                ...d.workouts,
                                {
                                  id: crypto.randomUUID(),
                                  title: "Planned workout",
                                  instructions: "",
                                },
                              ],
                            })
                          }
                        >
                          Add planned workout (draft only)
                        </button>
                        {d.workouts.map((s, si) => (
                          <div
                            key={s.id}
                            className="space-y-2 rounded border p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="flex-1">
                                {si + 1}.{" "}
                                {videos.find((v) => v.id === s.video_id)
                                  ?.title ??
                                  "Workout unavailable — replace before submitting"}
                              </strong>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={si === 0}
                                aria-label={`Move workout ${si + 1} up`}
                                onClick={() =>
                                  dayChange(wi, di, {
                                    ...d,
                                    workouts: moveProgramItem(
                                      d.workouts,
                                      si,
                                      -1,
                                    ),
                                  })
                                }
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={si === d.workouts.length - 1}
                                aria-label={`Move workout ${si + 1} down`}
                                onClick={() =>
                                  dayChange(wi, di, {
                                    ...d,
                                    workouts: moveProgramItem(
                                      d.workouts,
                                      si,
                                      1,
                                    ),
                                  })
                                }
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() =>
                                  dayChange(wi, di, {
                                    ...d,
                                    workouts: d.workouts.filter(
                                      (_, j) => j !== si,
                                    ),
                                  })
                                }
                              >
                                Remove
                              </button>
                            </div>
                            <label className="block">
                              Primary approved follow-along workout
                              <select
                                className="field"
                                value={s.video_id ?? ""}
                                onChange={(e) => {
                                  const next = { ...s };
                                  if (e.target.value)
                                    next.video_id = e.target.value;
                                  else delete next.video_id;
                                  dayChange(wi, di, {
                                    ...d,
                                    workouts: d.workouts.map((old, j) =>
                                      j === si ? next : old,
                                    ),
                                  });
                                }}
                              >
                                <option value="">
                                  Planned · not available for purchase
                                </option>
                                {videos.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              Workout instructions
                              <textarea
                                className="field"
                                maxLength={4000}
                                value={s.instructions}
                                onChange={(e) =>
                                  dayChange(wi, di, {
                                    ...d,
                                    workouts: d.workouts.map((step, j) =>
                                      j === si
                                        ? {
                                            ...step,
                                            instructions: e.target.value,
                                          }
                                        : step,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label className="block">
                              Step timer (seconds; blank uses the primary
                              workout duration)
                              <input
                                className="field"
                                type="number"
                                min={0}
                                max={18000}
                                step={1}
                                value={s.duration_seconds ?? ""}
                                onChange={(e) => {
                                  const next = { ...s };
                                  if (e.target.value === "")
                                    delete next.duration_seconds;
                                  else
                                    next.duration_seconds = Number(
                                      e.target.value,
                                    );
                                  dayChange(wi, di, {
                                    ...d,
                                    workouts: d.workouts.map((old, j) =>
                                      j === si ? next : old,
                                    ),
                                  });
                                }}
                              />
                            </label>
                            {s.video_id && (
                              <PrivateVideoPreview id={s.video_id} />
                            )}
                            <ExerciseVariationsEditor
                              videos={videos}
                              images={images}
                              variations={s.variations ?? []}
                              onChange={(variations) =>
                                dayChange(wi, di, {
                                  ...d,
                                  workouts: d.workouts.map((old, j) =>
                                    j === si ? { ...old, variations } : old,
                                  ),
                                })
                              }
                            />
                            <ProgramExercisesEditor
                              videos={videos}
                              images={images}
                              exercises={s.exercises ?? []}
                              onChange={(exercises) =>
                                dayChange(wi, di, {
                                  ...d,
                                  workouts: d.workouts.map((old, j) =>
                                    j === si
                                      ? {
                                          ...old,
                                          exercises,
                                          intervals: (old.intervals ?? []).map(
                                            (p) =>
                                              p.exercise_id &&
                                              !exercises.some(
                                                (ex) => ex.id === p.exercise_id,
                                              )
                                                ? {
                                                    id: p.id,
                                                    label: p.label,
                                                    kind: p.kind,
                                                    seconds: p.seconds,
                                                  }
                                                : p,
                                          ),
                                        }
                                      : old,
                                  ),
                                })
                              }
                            />
                            <ProgramIntervalsEditor
                              exercises={s.exercises ?? []}
                              intervals={s.intervals ?? []}
                              onChange={(intervals) =>
                                dayChange(wi, di, {
                                  ...d,
                                  workouts: d.workouts.map((old, j) =>
                                    j === si ? { ...old, intervals } : old,
                                  ),
                                })
                              }
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={w.days.length >= 7}
                  onClick={() =>
                    change({
                      ...doc,
                      weeks: doc.weeks.map((old, i) =>
                        i === wi
                          ? { ...old, days: [...old.days, newProgramDay()] }
                          : old,
                      ),
                    })
                  }
                >
                  Add day
                </button>
              </section>
            ))
          )}
          {!preview && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={doc.weeks.length >= 52}
              onClick={() =>
                change({
                  ...doc,
                  weeks: [
                    ...doc.weeks,
                    {
                      id: crypto.randomUUID(),
                      title: `Week ${doc.weeks.length + 1}`,
                      days: [newProgramDay()],
                    },
                  ],
                })
              }
            >
              Add week
            </button>
          )}
          {!videos.length && (
            <p className="text-sm">
              No approved Bunny workouts found. Upload videos in On-demand and
              have an admin approve them before publishing. You can plan and
              save drafts now.
            </p>
          )}
          <label className="block">
            Private exercise demonstration images (JPEG, PNG, WebP, up to 5 MB)
            <input
              type="file"
              className="field"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !me) return;
                if (
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    file.type,
                  ) ||
                  file.size > 5242880
                ) {
                  toast.error("Choose a JPEG, PNG or WebP up to 5 MB");
                  return;
                }
                setBusy(true);
                void (async () => {
                  try {
                    const path = `${me}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
                    const r = await supabase.storage
                      .from("program-demonstrations")
                      .upload(path, file, {
                        upsert: false,
                        contentType: file.type,
                      });
                    if (r.error) throw r.error;
                    await registerProgramImage({ data: { path } });
                    toast.success(
                      "Private image submitted for independent review",
                    );
                    await load();
                  } catch (err) {
                    toast.error(errorText(err));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </label>
          <p className="text-xs">
            Program editions can only publish when every included workout and
            demonstration is approved and available. Planned workouts stay in
            drafts. Submitted images cannot be overwritten.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => void save(true)}
            >
              Save and submit new edition
            </button>
            {selected &&
              programs.find((p) => p.id === selected)?.current_edition && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    const p = programs.find((p) => p.id === selected)!;
                    void setFitnessProgramVisibility({
                      data: { id: selected, published: !p.published },
                    })
                      .then(() => load())
                      .catch((e) => toast.error(errorText(e)));
                  }}
                >
                  {programs.find((p) => p.id === selected)?.published
                    ? "Unpublish (members retain access)"
                    : "Republish approved edition"}
                </button>
              )}
          </div>
          {dirty && (
            <p className="text-xs" role="status">
              Unsaved changes
            </p>
          )}
        </fieldset>
      </form>
      {editions.length > 0 && (
        <section className="card p-5">
          <h3 className="font-bold">Edition history</h3>
          {editions.map((e) => (
            <p key={e.id} className="my-2">
              Edition {e.version}: {e.review_status}{" "}
              {e.review_note && `· ${e.review_note}`} ·{" "}
              {new Date(e.created_at).toLocaleDateString()}
            </p>
          ))}
        </section>
      )}
    </section>
  );
}
