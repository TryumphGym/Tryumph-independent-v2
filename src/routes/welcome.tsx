import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore, type Cert } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Avatar";
import {
  RolePicker,
  CertManager,
  YouthConsent,
  useYouthStatus,
} from "@/components/CoachCredentials";
import { canSubmitCoach } from "@/lib/data";
import { GearPicker } from "@/components/GearPicker";
import { FITNESS_GOALS } from "@/lib/fitness-goals";
import { MultiDropdown } from "@/components/WorkoutFilters";
import {
  useUnits,
  UnitToggle,
  HeightInput,
  WeightInput,
} from "@/components/Units";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Set Up Your Profile — Tryumph Gym" },
      {
        name: "description",
        content:
          "Tell us about your body, goals and needs so Tryumph can recommend the right workouts.",
      },
      { property: "og:title", content: "Set Up Your Profile — Tryumph Gym" },
      {
        property: "og:description",
        content: "A quick profile so your workouts fit you.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (q: Record<string, unknown>): { apply?: boolean } =>
    q["apply"] ? { apply: true } : {},
  component: Welcome,
});

const NEEDS = [
  "Low impact",
  "Knee friendly",
  "Postpartum",
  "Diastasis recti safe",
  "Pregnant",
  "Back care",
  "Joint mobility",
  "No equipment",
];
const SPECIALTIES = [
  "Postpartum",
  "Diastasis recti safe",
  "Low impact",
  "Knee friendly",
  "Strength",
  "HIIT",
  "Cardio",
  "Yoga",
  "Pilates",
  "Mobility",
];

export const bmiOf = (heightCm: number, weightKg: number) =>
  heightCm > 0 && weightKg > 0 ? weightKg / (heightCm / 100) ** 2 : 0;
const bmiNote = (b: number) =>
  (!b
    ? ""
    : b < 18.5
      ? "Below the typical range"
      : b < 25
        ? "In the typical range"
        : b < 30
          ? "Above the typical range"
          : "Well above the typical range") +
  (b ? " — BMI is just one starting point, not a judgement." : "");

const toggle = (list: string[], v: string) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

function Welcome() {
  const { s, set, setExtra, uid } = useStore();
  const navigate = useNavigate();
  const { apply } = Route.useSearch();
  if (!s.signedIn)
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <p>Create an account first.</p>
        <Link to="/account" className="btn btn-primary mt-4">
          Go to account
        </Link>
      </div>
    );
  return s.role === "trainer" || apply ? <TrainerSetup /> : <MemberSetup />;
}

function MemberSetup() {
  const { s, set, setExtra, uid } = useStore();
  const navigate = useNavigate();

  const p = s.profile;
  const e = s.extra;
  const [units, setUnits] = useUnits();
  const bmi = bmiOf(p.height, p.weight);
  const finish = () => {
    setExtra((x) => ({ ...x, onboarded: true }));
    toast.success("Profile saved — welcome to Tryumph!");
    navigate({ to: "/" });
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Step 1 of 1"
        title="Let's build your profile"
        sub="This helps us recommend workouts that fit your body and life."
      />
      <div className="card space-y-6 p-6">
        <div className="grid grid-cols-3 gap-3">
          <HeightInput
            cm={p.height}
            units={units}
            onChange={(v) =>
              set((x) => ({ ...x, profile: { ...x.profile, height: v } }))
            }
          />
          <WeightInput
            kg={p.weight}
            units={units}
            onChange={(v) =>
              set((x) => ({ ...x, profile: { ...x.profile, weight: v } }))
            }
          />
          <div className="rounded-xl bg-secondary p-3">
            <p className="text-xs text-muted-foreground">BMI (auto)</p>
            <p className="font-display text-2xl font-bold">
              {bmi ? bmi.toFixed(1) : "—"}
            </p>
          </div>
        </div>
        <UnitToggle units={units} onChange={setUnits} />
        {bmi > 0 && (
          <p className="text-xs text-muted-foreground">{bmiNote(bmi)}</p>
        )}
        <MultiDropdown
          label="Fitness goals"
          values={e.goals}
          options={FITNESS_GOALS}
          emptyLabel="Choose goals"
          onChange={(goals) => setExtra((x) => ({ ...x, goals }))}
        />
        <div>
          <p className="mb-2 font-semibold">
            What kind of fitness do you need?
          </p>
          <div className="flex flex-wrap gap-2">
            {NEEDS.map((g) => (
              <button
                key={g}
                className={`chip ${e.conditions.includes(g) ? "chip-active" : ""}`}
                onClick={() => {
                  setExtra((x) => ({
                    ...x,
                    conditions: toggle(x.conditions, g),
                  }));
                  if (g === "Postpartum")
                    set((x) => ({
                      ...x,
                      profile: {
                        ...x.profile,
                        postpartum: !e.conditions.includes(g),
                      },
                    }));
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <GearPicker />
        {e.conditions.includes("Postpartum") && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Weeks postpartum
              <input
                type="number"
                className="field mt-1"
                value={p.weeksPostpartum}
                onChange={(ev) =>
                  set((x) => ({
                    ...x,
                    profile: { ...x.profile, weeksPostpartum: ev.target.value },
                  }))
                }
              />
            </label>
            <label className="text-sm">
              Ab separation (finger widths)
              <input
                type="number"
                className="field mt-1"
                value={p.drGap}
                onChange={(ev) =>
                  set((x) => ({
                    ...x,
                    profile: { ...x.profile, drGap: ev.target.value },
                  }))
                }
              />
            </label>
          </div>
        )}
        <label className="block text-sm font-semibold">
          Why did you choose Tryumph?
          <textarea
            className="field mt-2 min-h-20 font-normal"
            placeholder="What brought you here today?"
            value={e.why}
            onChange={(ev) => setExtra((x) => ({ ...x, why: ev.target.value }))}
          />
        </label>
        <button
          className="btn btn-primary w-full"
          disabled={!p.height || !p.weight || e.goals.length === 0}
          onClick={finish}
        >
          Save profile
        </button>
      </div>
    </div>
  );
}

function TrainerSetup() {
  const { s, set, setExtra, uid } = useStore();
  const navigate = useNavigate();

  const tr = s.extra.trainer;
  const [credentialCount, setCredentialCount] = useState(0);
  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const result = await supabase
          .from("certifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", data.user.id);
        setCredentialCount(result.count ?? 0);
      }
    });
  }, [s.extra]);
  const upd = (patch: Partial<typeof tr>) =>
    setExtra((x) => ({ ...x, trainer: { ...x.trainer, ...patch } }));
  const finish = () => {
    set((x) => ({
      ...x,
      role: "trainer",
      extra: { ...x.extra, onboarded: true },
    }));
    toast.success("Application saved — certifications are pending review.");
    navigate({ to: "/studio" });
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Trainer application"
        title="Set up your coaching profile"
        sub="We verify every certification before your Verified Pro badge goes live."
      />
      <div className="card space-y-6 p-6">
        <RolePicker />
        <CertManager onCount={setCredentialCount} />
        <div>
          <p className="mb-2 font-semibold">Specialties</p>
          <div className="flex flex-wrap gap-2">
            {SPECIALTIES.map((g) => (
              <button
                key={g}
                className={`chip ${tr.specialties.includes(g) ? "chip-active" : ""}`}
                onClick={() => upd({ specialties: toggle(tr.specialties, g) })}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">
            1-on-1 rate ($)
            <input
              type="number"
              className="field mt-1"
              value={tr.rate}
              onChange={(ev) => upd({ rate: +ev.target.value })}
            />
          </label>
          <label className="col-span-2 text-sm">
            Short bio
            <input
              className="field mt-1"
              value={tr.bio}
              onChange={(ev) => upd({ bio: ev.target.value })}
              placeholder="Who is your Trybe for?"
            />
          </label>
        </div>
        <label className="flex gap-3 rounded-xl bg-secondary p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={tr.agreed}
            onChange={(ev) => upd({ agreed: ev.target.checked })}
          />
          <span>
            <b>Tryumph Client Protection.</b> I agree that any client I meet
            through Tryumph stays with Tryumph — booked, paid and coached on the
            platform.
          </span>
        </label>
        {!(credentialCount > 0) && (
          <p className="text-sm text-warning">
            Add at least one certification to apply.
          </p>
        )}
        <button
          className="btn btn-primary w-full"
          disabled={
            tr.specialties.length === 0 || !tr.agreed || !(credentialCount > 0)
          }
          onClick={finish}
        >
          Submit application
        </button>
      </div>
    </div>
  );
}
