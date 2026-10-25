import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { GearPicker } from "@/components/GearPicker";
import { FITNESS_GOALS } from "@/lib/fitness-goals";
import { MultiDropdown } from "@/components/WorkoutFilters";
import { useUnits, UnitToggle, HeightInput, WeightInput, weightLabel, fromDisplayWeight, fmtWeight } from "@/components/Units";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Account — Tryumph Gym" },
      { name: "description", content: "Free account with health baseline, BMI and postpartum / diastasis recti tracking." },
      { property: "og:title", content: "Your Account — Tryumph Gym" },
      { property: "og:description", content: "Track your health baseline for free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Account,
});

function Account() {
  const { s, set, signIn, signOut } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"member" | "trainer">("member");

  const handleEmailAuth = async () => {
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim(), requested_role: role } },
        });
        if (error) throw error;
        if (data.session) {
          signIn(name.trim(), role);
          navigate({ to: "/welcome" });
        } else {
          toast.success("Check your email to confirm your account, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!s.signedIn) {
    const isSignup = mode === "signup";
    const canSubmit = isSignup
      ? Boolean(name.trim() && email.trim() && password.length >= 6)
      : Boolean(email.trim() && password.length >= 1);
    return (
      <div className="mx-auto max-w-md">
        <PageHeader
          eyebrow={isSignup ? "Free forever" : "Welcome back"}
          title={isSignup ? "Create your account" : "Sign in"}
          sub={isSignup
            ? "Track your progress, join lives and post in Trybes."
            : "Pick up where you left off — your streak, wallet and Trybes."}
        />
        <div className="card overflow-hidden">
          <div className={`h-1.5 ${isSignup ? "bg-brand" : "bg-accent"}`} />
          <div className="auth-tabs">
            {(["signup", "signin"] as const).map((m) => (
              <button key={m} type="button" className={`auth-tab ${mode === m ? "auth-tab-active" : ""}`} onClick={() => setMode(m)}>
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>
          <form className="space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); if (canSubmit) handleEmailAuth(); }}>
            <button
              type="button"
              className="btn btn-outline w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/account" } });
                setBusy(false);
                if (error) toast.error(error.message ?? "Google sign-in failed");
              }}
            >
              Continue with Google
            </button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{isSignup ? "or with email" : "or your password"}<span className="h-px flex-1 bg-border" /></div>
            {isSignup && <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />}
            <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="field" type="password" placeholder={isSignup ? "Password (6+ characters)" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            {isSignup && (
              <div className="flex gap-2">
                {(["member", "trainer"] as const).map((r) => <button type="button" key={r} className={`chip flex-1 ${role === r ? "chip-active" : ""}`} onClick={() => setRole(r)}>{r === "member" ? "Member" : "Trainer"}</button>)}
              </div>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={busy || !canSubmit}>
              {busy ? "One moment…" : isSignup ? "Create account" : "Sign in"}
            </button>
            <button type="button" className="w-full text-center text-sm text-primary" onClick={() => setMode(isSignup ? "signin" : "signup")}>
              {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
            <p className="text-xs text-muted-foreground">
              {isSignup ? "Your account is saved securely online — sign in from any device." : "Use the same email and password you signed up with."}
            </p>
          </form>
        </div>
      </div>
    );
  }

  return <SignedInAccount />;
}

const NEED_OPTS = ["Low impact", "Knee friendly", "Postpartum", "Diastasis recti safe", "Pregnant", "Back care", "Joint mobility", "No equipment"];
const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

function SignedInAccount() {
  const { s, set, signOut } = useStore();
  const [units, setUnits] = useUnits();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({ name: s.name, profile: s.profile, goals: s.extra.goals, conditions: s.extra.conditions, dueDate: s.extra.dueDate ?? "" }));
  const [w, setW] = useState("");
  const startEdit = () => { setDraft({ name: s.name, profile: s.profile, goals: s.extra.goals, conditions: s.extra.conditions, dueDate: s.extra.dueDate ?? "" }); setEditing(true); };
  const save = () => {
    set((x) => ({ ...x, name: draft.name.trim() || x.name, profile: { ...draft.profile, level: x.profile.level, postpartum: draft.conditions.includes("Postpartum") }, extra: { ...x.extra, goals: draft.goals, conditions: draft.conditions, pregnant: draft.conditions.includes("Pregnant"), dueDate: draft.dueDate, onboarded: true } }));
    setEditing(false);
    toast.success("Profile saved");
  };
  const p = editing ? draft.profile : s.profile;
  const goals = editing ? draft.goals : s.extra.goals;
  const conds = editing ? draft.conditions : s.extra.conditions;
  const updP = (k: keyof typeof p, v: string | number | boolean) => setDraft((d) => ({ ...d, profile: { ...d.profile, [k]: v } }));
  const uploadPhoto = async (file: File) => {
    const { data: ud } = await supabase.auth.getUser();
    const uidNow = ud.user?.id;
    if (!uidNow) { toast.error("Sign in again to update your photo."); return; }
    const path = `${uidNow}/avatar`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error("Photo upload failed — try a smaller image (under 5 MB)."); return; }
    set((x) => ({ ...x, profile: { ...x.profile, avatar: path } }));
    toast.success("Profile photo updated");
  };
  const bmi = p.height && p.weight ? p.weight / (p.height / 100) ** 2 : 0;

  return (
    <div>
      <PageHeader eyebrow={s.role === "trainer" ? "Trainer account" : "Member account"} title={`Hi, ${s.name}`}>
        <div className="flex flex-wrap gap-2">
          {s.role === "member" && (editing ? (
            <>
              <button className="btn btn-primary" onClick={save}>Save changes</button>
              <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : <button className="btn btn-primary" onClick={startEdit}>Edit profile</button>)}
          <button className="btn btn-outline" onClick={signOut}>Sign out</button>
        </div>
      </PageHeader>
      {s.signedIn && !editing && <div className="mb-6"><GearPicker /></div>}
      <div className="card mb-6 flex flex-wrap items-center gap-4 p-6">
        <Avatar size="lg" initials={s.name.slice(0, 2).toUpperCase()} src={s.profile.avatar || undefined} />
        <div>
          <h2 className="font-bold">Profile photo</h2>
          <p className="text-sm text-muted-foreground">PNG or JPG, up to 5 MB. Shown next to your name.</p>
          <label className="btn btn-outline mt-2 cursor-pointer">
            Upload photo
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      {s.role === "trainer" ? (
        <div className="card space-y-3 p-6">
          <h2 className="text-xl font-bold">Coaching profile</h2>
          <p className="text-sm text-muted-foreground">{s.extra.trainer.kind === "Both" ? "Trainer & Nutritionist" : s.extra.trainer.kind} · ${s.extra.trainer.rate}/session · {s.extra.trainer.specialties.join(", ") || "No specialties yet"}</p>
          <ul className="space-y-1 text-sm">{s.extra.trainer.certs.map((c) => <li key={c.id}>{c.name} — <span className="text-warning">{c.status}</span></li>)}</ul>
          <div className="flex gap-2"><Link to="/welcome" className="btn btn-primary">Edit certifications & specialties</Link><Link to="/studio" className="btn btn-ghost">Open Studio</Link></div>
        </div>
      ) : (
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-6">
          <h2 className="text-xl font-bold">Health baseline</h2>
          {editing ? (
            <>
              <label className="block text-sm">Name<input className="field mt-1" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></label>
              <div className="grid grid-cols-2 gap-3">
                <HeightInput cm={p.height} units={units} onChange={(v) => updP("height", v)} />
                <WeightInput kg={p.weight} units={units} onChange={(v) => updP("weight", v)} />
              </div>
              <UnitToggle units={units} onChange={setUnits} />
              <label className="block text-sm">Preferences<input className="field mt-1" placeholder="e.g. low impact, quiet workouts" value={p.prefs} onChange={(e) => updP("prefs", e.target.value)} /></label>
            </>
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Height</dt><dd className="font-semibold">{units === "us" ? `${Math.floor(p.height / 2.54 / 12)}' ${Math.round(p.height / 2.54 % 12)}"` : `${p.height} cm`}</dd></div>
              <div><dt className="text-muted-foreground">Weight</dt><dd className="font-semibold">{fmtWeight(p.weight, units)}</dd></div>
              <div><dt className="text-muted-foreground">Level</dt><dd className="font-semibold">{p.level}</dd></div>
              <div><dt className="text-muted-foreground">Preferences</dt><dd className="font-semibold">{p.prefs || "—"}</dd></div>
            </dl>
          )}
          <div className="rounded-xl bg-secondary p-4"><p className="text-sm text-muted-foreground">BMI</p><p className="font-display text-3xl font-bold">{bmi ? bmi.toFixed(1) : "—"}</p></div>
        </section>
        <section className="space-y-6">
          <div className="card space-y-4 p-6">
            <h2 className="text-xl font-bold">Goals & needs</h2>
            {editing ? <MultiDropdown label="Fitness goals" values={goals} options={FITNESS_GOALS} emptyLabel="Choose goals" onChange={(values) => setDraft((d) => ({ ...d, goals: values }))} /> : <p className="text-sm">{goals.join(" · ") || "No goals yet"}</p>}
            <div className="flex flex-wrap gap-2">{(editing ? NEED_OPTS : conds).map((g) => <button key={g} type="button" disabled={!editing} className={`chip ${conds.includes(g) ? "chip-active" : ""}`} onClick={() => setDraft((d) => ({ ...d, conditions: tog(d.conditions, g) }))}>{g}</button>)}</div>
            {conds.includes("Pregnant") && (editing
              ? <label className="block text-sm">Due date (optional)<input type="date" className="field mt-1" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} /></label>
              : <p className="text-sm text-primary">Pregnancy-safe workouts are highlighted for you{s.extra.dueDate ? ` · due ${s.extra.dueDate}` : ""}.</p>)}
            {conds.includes("Postpartum") && (editing ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">Weeks postpartum<input type="number" className="field mt-1" value={p.weeksPostpartum} onChange={(e) => updP("weeksPostpartum", e.target.value)} /></label>
                <label className="text-sm">Ab separation (finger widths)<input type="number" className="field mt-1" value={p.drGap} onChange={(e) => updP("drGap", e.target.value)} /></label>
              </div>
            ) : <p className="text-sm text-primary">Suggested: Diastasis-Safe Core Rebuild & Pelvic Floor Foundations.</p>)}
          </div>
          <div className="card space-y-3 p-6">
            <h2 className="text-xl font-bold">Interested in coaching on Tryumph?</h2>
            <p className="text-sm text-muted-foreground">Certified fitness trainers can apply. We review every application.</p>
            <Link to="/welcome" search={{ apply: true }} className="btn btn-outline">Apply as a trainer</Link>
          </div>
          <div className="card space-y-3 p-6">
            <h2 className="text-xl font-bold">Weigh-ins</h2>
            <div className="flex gap-2">
              <input type="number" className="field" placeholder={weightLabel(units)} value={w} onChange={(e) => setW(e.target.value)} />
              <button className="btn btn-primary" onClick={() => { if (!+w) return; const kg = fromDisplayWeight(+w, units); set((x) => ({ ...x, weighIns: [{ date: new Date().toISOString().slice(0, 10), weight: kg }, ...x.weighIns], profile: { ...x.profile, weight: kg } })); setW(""); toast.success("Weigh-in saved"); }}>Log</button>
            </div>
            {s.weighIns.map((x, i) => <p key={i} className="flex justify-between text-sm"><span className="text-muted-foreground">{x.date}</span>{fmtWeight(x.weight, units)}</p>)}
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
