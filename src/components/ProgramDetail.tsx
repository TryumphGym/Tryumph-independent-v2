import { ProgramDownloads } from "./ProgramDownloads";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import {
  PROGRAM_SAFETY,
  programProgress,
  programSchema,
  type FitnessProgram,
  type ProgramSummary,
} from "@/lib/programs";
import {
  buyFitnessProgram,
  enrollFitnessProgram,
  programCheckoutAvailability,
  updateProgramProgress,
} from "@/lib/programs.functions";
import type { Tables } from "@/integrations/supabase/types";
import { ProgramStepPlayer } from "./ProgramStepPlayer";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Program unavailable";
export function ProgramDetail({ id }: { id: string }) {
  const me = useUserId();
  return <ProgramDetailForViewer key={`${me}:${id}`} id={id} me={me} />;
}
function ProgramDetailForViewer({ id, me }: { id: string; me: string | null }) {
  const [program, setProgram] = useState<Tables<"trainer_programs"> | null>(
      null,
    ),
    [edition, setEdition] = useState<Tables<"program_editions"> | null>(null),
    [doc, setDoc] = useState<FitnessProgram | null>(null),
    [enrollment, setEnrollment] =
      useState<Tables<"program_member_enrollments"> | null>(null),
    [progress, setProgress] = useState<Tables<"program_progress">[]>([]),
    [downloadsCompleted, setDownloadsCompleted] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [nativeEnabled, setNativeEnabled] = useState(false),
    [included, setIncluded] = useState(false),
    [week, setWeek] = useState(0),
    [day, setDay] = useState(0),
    [player, setPlayer] = useState<string | null>(null);
  const generation = useRef(Symbol());
  const load = useCallback(async () => {
    const request = Symbol();
    generation.current = request;
    setLoading(true);
    setError("");
    setPlayer(null);
    setDoc(null);
    setEdition(null);
    setEnrollment(null);
    setProgress([]);
    try {
      const p = await supabase
        .from("trainer_programs")
        .select("*")
        .eq("id", id)
        .eq("builder_version", 2)
        .maybeSingle();
      if (request !== generation.current) return;
      if (p.error) throw p.error;
      setProgram(p.data);
      setDoc(null);
      setEdition(null);
      setEnrollment(null);
      setProgress([]);
      if (!p.data) return;
      if (me) {
        const benefit = await supabase.rpc("program_subscription_benefit", {
          p_id: id,
        });
        if (request !== generation.current) return;
        setIncluded(!benefit.error && benefit.data === true);
        const n = await supabase
          .from("program_member_enrollments")
          .select("*")
          .eq("program_id", id)
          .eq("user_id", me)
          .order("created_at", { ascending: false });
        if (request !== generation.current) return;
        if (n.error) throw n.error;
        const own =
          n.data.find(
            (e) =>
              e.state === "active" &&
              (!e.expires_at || new Date(e.expires_at).getTime() > Date.now()),
          ) ??
          n.data[0] ??
          null;
        setEnrollment(own);
        const editionId =
          own?.state === "active" &&
          (!own.expires_at || new Date(own.expires_at).getTime() > Date.now())
            ? own.edition_id
            : p.data.current_edition;
        if (editionId) {
          const e = await supabase
            .from("program_editions")
            .select("*")
            .eq("id", editionId)
            .maybeSingle();
          if (request !== generation.current) return;
          if (e.error) throw e.error;
          if (e.data) {
            const parsed = programSchema.parse(e.data.document);
            setEdition(e.data);
            setDoc(parsed);
            const history = await supabase
              .from("program_progress")
              .select("*")
              .eq("edition_id", editionId)
              .eq("user_id", me);
            if (request !== generation.current) return;
            if (history.error) throw history.error;
            setProgress(history.data);
            const resume = programProgress(parsed, history.data).resume;
            setWeek(resume?.week ?? 0);
            setDay(resume?.day ?? 0);
          }
        }
      }
    } catch (e) {
      if (request !== generation.current) return;
      console.error("Program detail unavailable", e);
      setError("We could not load this program. Please try again.");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [id, me]);
  useEffect(() => {
    void load();
    return () => {
      generation.current = Symbol();
    };
  }, [load]);
  useEffect(() => {
    void programCheckoutAvailability()
      .then((r) => setNativeEnabled(r.enabled))
      .catch(() => setNativeEnabled(false));
  }, []);
  useEffect(() => {
    setPlayer(null);
  }, [week, day]);
  const action = async (run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const play = async (stepId: string) => {
    if (!edition) return;
    const request = generation.current;
    await action(async () => {
      if (enrollment?.state === "active")
        await updateProgramProgress({
          data: { editionId: edition.id, stepId },
        });
      if (request === generation.current) setPlayer(stepId);
    });
  };
  if (loading)
    return (
      <p role="status" className="card p-6">
        Loading program…
      </p>
    );
  if (error)
    return (
      <div className="card p-6" role="alert">
        {error}
        <button className="btn btn-ghost" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  if (!program)
    return (
      <p className="card p-6">
        This program is unavailable, unpublished, or restricted to existing
        members.
      </p>
    );
  if (!program.current_edition && !doc)
    return (
      <section className="card space-y-3 p-6">
        <h1 className="text-2xl font-bold">{program.title}</h1>
        <p>
          This draft has not been approved or published. No enrollment or
          purchase is available.
        </p>
        <Link className="text-primary underline" to="/studio">
          Return to Trainer Studio
        </Link>
      </section>
    );
  const summary = program.summary as unknown as ProgramSummary;
  const display = doc ?? summary;
  const expired =
    !!enrollment?.expires_at &&
    new Date(enrollment.expires_at).getTime() <= Date.now();
  const workoutTotals = doc ? programProgress(doc, progress) : null;
  const totalItems = (workoutTotals?.total ?? 0) + (doc?.downloads.length ?? 0);
  const completedItems = (workoutTotals?.completed ?? 0) + downloadsCompleted;
  const totals = workoutTotals
    ? {
        ...workoutTotals,
        total: totalItems,
        completed: completedItems,
        percent: totalItems
          ? Math.round((completedItems / totalItems) * 100)
          : 0,
      }
    : null;
  const selectedDay = doc?.weeks[week]?.days[day];
  return (
    <section className="space-y-5">
      <header className="card grid gap-5 p-6 md:grid-cols-2">
        {display.cover_url && (
          <img
            src={display.cover_url}
            alt=""
            referrerPolicy="no-referrer"
            className="aspect-video w-full rounded object-cover"
          />
        )}
        <div>
          <p className="eyebrow">
            {display.category} · {display.difficulty} · Intensity:{" "}
            {display.intensity || "Not specified"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {display.title ?? program.title}
          </h1>
          <p className="mt-3 whitespace-pre-wrap text-muted-foreground">
            {display.description ?? program.description}
          </p>
          <p className="mt-3">
            {doc?.weeks.length ?? summary.duration_weeks} weeks · Equipment:{" "}
            {(display.equipment ?? []).filter(Boolean).join(", ") ||
              "Not specified"}
          </p>
          <p className="mt-2 text-sm">
            Goals:{" "}
            {(display.goals ?? []).filter(Boolean).join(", ") ||
              "General fitness"}
          </p>
          <Link
            className="mt-3 inline-block text-primary underline"
            to="/trainers/$id"
            params={{ id: program.trainer_id }}
          >
            Trainer profile and storefront →
          </Link>
        </div>
      </header>
      <aside className="card p-5 text-sm">
        <strong>
          Pregnancy: {display.pregnancy?.replaceAll("_", " ")} · Postpartum:{" "}
          {display.postpartum?.replaceAll("_", " ")}
        </strong>
        <p className="my-2 whitespace-pre-wrap">{display.suitability_notes}</p>
        <p>{PROGRAM_SAFETY}</p>
      </aside>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/trybes"
          search={{ t: `coach-${program.trainer_id}` }}
          className="text-primary underline"
        >
          Trainer’s Trybe
        </Link>
        <button
          className="text-primary underline"
          onClick={() =>
            void navigator.clipboard
              .writeText(`${window.location.origin}/programs/${program.id}`)
              .then(() => toast.success("Program link copied"))
              .catch(() => toast.error("Copy this page URL to share"))
          }
        >
          Copy public program link
        </button>
      </div>
      {!doc && summary.included_schedule && (
        <section className="card space-y-3 p-5">
          <h2 className="text-xl font-bold">Included and available</h2>
          {summary.included_schedule.map((w, wi) => (
            <details key={wi}>
              <summary>
                Week {wi + 1} · {w.title}
              </summary>
              {w.days.map((d, di) => (
                <div key={di} className="ml-3 mt-2">
                  <strong>
                    Day {di + 1} · {d.title}
                    {d.rest ? " · rest" : ""}
                  </strong>
                  {d.workouts.map((s, i) => (
                    <p key={i} className="text-sm">
                      {s.title} · {Math.ceil(s.duration_seconds / 60)} min ·
                      available
                    </p>
                  ))}
                </div>
              ))}
            </details>
          ))}
        </section>
      )}
      {!doc && (
        <div className="card space-y-3 p-6">
          {program.blocked && (
            <p role="alert">
              This program is temporarily unavailable during moderation. Contact
              support about your purchase.
            </p>
          )}
          <h2 className="text-xl font-bold">
            {included
              ? "Included with your subscription"
              : summary.mode === "free"
                ? "Free enrollment"
                : summary.mode === "members"
                  ? "Members Only — active subscription required"
                  : summary.mode === "external"
                    ? "Purchase from the trainer"
                    : `One-time purchase · $${(summary.price_cents / 100).toFixed(2)}`}
          </h2>
          {summary.mode === "native" && (
            <p className="text-sm text-muted-foreground">
              One-time purchase, independent of subscription. This edition is
              also included with a subscription only when explicitly configured.{" "}
              {summary.access_period === "lifetime"
                ? "Lifetime access."
                : `${summary.access_period} days of access from payment confirmation.`}{" "}
              Your purchased edition is preserved if the listing changes.
              Refunds, disputes or safety moderation can suspend access; contact
              support for review. A queued refund is not a confirmed refund.
            </p>
          )}
          {enrollment?.state === "active" && !expired && !doc && (
            <p role="alert">
              Your enrolled edition is unavailable while under review or
              moderation. Contact support before making another purchase.
            </p>
          )}
          {expired && (
            <p role="status">
              Your access period ended on{" "}
              {new Date(enrollment!.expires_at!).toLocaleDateString()}. Your
              completion history is preserved. A new purchase starts a new
              access period.
            </p>
          )}
          {enrollment?.state === "revoked" && !expired && (
            <p role="alert">
              Access to your prior purchase was revoked or a refund is pending.
              Contact support if you need help. Payment status is never inferred
              from a browser redirect.
            </p>
          )}
          {summary.mode === "external" ? (
            <>
              <a
                className="btn btn-primary inline-flex"
                href={summary.external_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
              >
                Visit external seller
              </a>
              <p className="text-sm">
                Payments happen with the seller; the trainer keeps 100% of
                external earnings. This link does not unlock Tryumph content.
                Ask support for an independent receipt review if the seller
                includes in-app access.
              </p>
            </>
          ) : !me ? (
            <Link className="btn btn-primary" to="/account">
              Sign in to{" "}
              {summary.mode === "free" || included ? "enroll" : "purchase"}
            </Link>
          ) : summary.mode === "members" && !included ? (
            <Link
              to="/trainers/$id"
              params={{ id: program.trainer_id }}
              className="btn btn-outline"
            >
              View trainer subscription
            </Link>
          ) : summary.mode === "free" || included ? (
            <button
              className="btn btn-primary"
              disabled={busy || program.blocked}
              onClick={() =>
                void action(async () => {
                  await enrollFitnessProgram({ data: { id } });
                  await load();
                })
              }
            >
              {included ? "Enroll with your subscription" : "Enroll free"}
            </button>
          ) : (
            <>
              <button
                className="btn btn-primary"
                disabled={
                  busy ||
                  program.blocked ||
                  !nativeEnabled ||
                  (enrollment?.state === "active" && !expired)
                }
                onClick={() =>
                  void action(async () => {
                    const r = await buyFitnessProgram({ data: { id } });
                    window.location.assign(r.url);
                  })
                }
              >
                Purchase program
              </button>
              {!nativeEnabled && (
                <p className="text-sm">
                  Native purchases are not available yet. Owner-approved
                  commercial terms and payment setup are required.
                </p>
              )}
            </>
          )}
        </div>
      )}
      {doc && edition && (
        <ProgramDownloads
          ids={doc.downloads}
          editionId={edition.id}
          onCompletedChange={setDownloadsCompleted}
          recordProgress={enrollment?.state === "active" && !expired}
        />
      )}
      {doc && edition && (
        <>
          <section className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">
                {enrollment?.state === "active"
                  ? "Your schedule"
                  : "Trainer/admin preview"}{" "}
                · edition {edition.version}
              </h2>
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void load()}
              >
                Refresh access
              </button>
            </div>
            <p className="text-sm">
              {enrollment?.expires_at
                ? `Access until ${new Date(enrollment.expires_at).toLocaleDateString()}. `
                : enrollment
                  ? "Lifetime access. "
                  : ""}
              {enrollment?.source === "external_reviewed"
                ? "External receipt manually reviewed. "
                : ""}
              {enrollment?.state === "active"
                ? "Your enrollment preserves this edition when the trainer publishes changes or unpublishes the listing."
                : "This is a review preview. Member progress is stored only after enrollment."}
            </p>
            {totals && (
              <>
                <label className="block">
                  {totals.completed} / {totals.total} lessons / guides complete
                  ({totals.percent}%)
                  <progress
                    className="mt-1 h-3 w-full"
                    max={100}
                    value={totals.percent}
                  />
                </label>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setWeek(totals.resume?.week ?? 0);
                    setDay(totals.resume?.day ?? 0);
                  }}
                >
                  Resume program
                </button>
              </>
            )}
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Week
              <select
                className="field"
                value={week}
                onChange={(e) => {
                  setWeek(Number(e.target.value));
                  setDay(0);
                }}
              >
                {doc.weeks.map((w, i) => (
                  <option value={i} key={w.id}>
                    Week {i + 1} · {w.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Day
              <select
                className="field"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {doc.weeks[week]?.days.map((d, i) => (
                  <option value={i} key={d.id}>
                    Day {i + 1} · {d.title}
                    {d.rest ? " (rest)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {player &&
            (() => {
              const step = doc.weeks
                .flatMap((w) => w.days.flatMap((d) => d.workouts))
                .find((s) => s.id === player);
              const saved = progress.find((r) => r.step_id === player);
              return step ? (
                <ProgramStepPlayer
                  key={`${edition.id}:${step.id}`}
                  recordProgress={enrollment?.state === "active" && !expired}
                  editionId={edition.id}
                  step={step}
                  initialElapsed={saved?.elapsed_seconds ?? 0}
                  initialVariation={saved?.variation_id ?? null}
                  onClose={() => {
                    const request = generation.current;
                    setPlayer(null);
                    void supabase
                      .from("program_progress")
                      .select("*")
                      .eq("edition_id", edition.id)
                      .eq("user_id", me!)
                      .then((r) => {
                        if (request === generation.current && !r.error)
                          setProgress(r.data);
                      });
                  }}
                />
              ) : null;
            })()}
          {selectedDay && (
            <section className="card space-y-4 p-6">
              <h3 className="text-xl font-bold">
                {selectedDay.title}
                {selectedDay.rest ? " · Rest day" : ""}
              </h3>
              <p className="whitespace-pre-wrap">{selectedDay.instructions}</p>
              {selectedDay.rest && (
                <p>
                  Take the planned rest or follow your clinician’s guidance.
                </p>
              )}
              {selectedDay.workouts.map((step, i) => (
                <article key={step.id} className="space-y-2 rounded border p-4">
                  <h4 className="font-bold">
                    {i + 1}. {step.title ?? "Approved workout"}
                  </h4>
                  <p className="whitespace-pre-wrap text-sm">
                    {step.instructions}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void play(step.id)}
                    >
                      Play workout
                    </button>
                    {enrollment?.state === "active" && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={progress.some(
                            (p) => p.step_id === step.id && p.completed,
                          )}
                          onChange={(e) => {
                            const completed = e.target.checked,
                              request = generation.current;
                            void action(async () => {
                              await updateProgramProgress({
                                data: {
                                  editionId: edition.id,
                                  stepId: step.id,
                                  completed,
                                },
                              });
                              const r = await supabase
                                .from("program_progress")
                                .select("*")
                                .eq("edition_id", edition.id)
                                .eq("user_id", me!);
                              if (r.error) throw r.error;
                              if (request === generation.current)
                                setProgress(r.data);
                            });
                          }}
                        />
                        Mark complete
                      </label>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Progress is your own completion record, not a medical assessment.
        Protected playback links expire and require fresh access checks.{" "}
        <Link className="text-primary underline" to="/contact">
          Contact Tryumph support
        </Link>{" "}
        for purchase or access help.
      </p>
    </section>
  );
}
