import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";

type Program = { id: string; title: string };
type Benefits = {
  scheduledLives: boolean;
  memberOnlyLives: boolean;
  liveClassesPerMonth: 0 | 4 | 8 | -1;
  programAccess: "none" | "all" | "selected";
  selectedProgramIds: string[];
  memberVideos: boolean;
  earlyAccess: boolean;
  trybePosts: boolean;
  autoIncludeNewPrograms: boolean;
};
type Tier = {
  trainer_id: string;
  tier_no: number;
  title: string;
  description: string;
  price_cents: number;
  benefits: Benefits;
  commission_bps: number;
};
type Policy = {
  four_class_min_cents: number;
  eight_class_min_cents: number;
  unlimited_min_cents: number;
  standard_commission_bps: number;
  live_commission_bps: number;
};
const DEFAULT_POLICY: Policy = {
  four_class_min_cents: 999,
  eight_class_min_cents: 1499,
  unlimited_min_cents: 2999,
  standard_commission_bps: 1000,
  live_commission_bps: 2000,
};
const emptyBenefits = (): Benefits => ({
  scheduledLives: false,
  memberOnlyLives: false,
  liveClassesPerMonth: 0,
  programAccess: "none",
  selectedProgramIds: [],
  memberVideos: false,
  earlyAccess: false,
  trybePosts: true,
  autoIncludeNewPrograms: false,
});
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Membership setup is unavailable";

export function CreatorTierWizard() {
  const trainerId = useUserId();
  return trainerId ? (
    <CreatorTierWizardForTrainer key={trainerId} trainerId={trainerId} />
  ) : null;
}
function CreatorTierWizardForTrainer({ trainerId }: { trainerId: string }) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [current, setCurrent] = useState(1);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("My Trybe membership");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("29.99");
  const [benefits, setBenefits] = useState<Benefits>(emptyBenefits);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectTier = (tier: number, source: Tier[] = tiers) => {
    const saved = source.find((item) => item.tier_no === tier);
    setCurrent(tier);
    setStep(1);
    setTitle(saved?.title ?? (tier === 1 ? "My Trybe membership" : `Tier ${tier}`));
    setDescription(saved?.description ?? "");
    setPrice(((saved?.price_cents ?? 2999) / 100).toFixed(2));
    setBenefits(saved?.benefits ?? emptyBenefits());
    setError("");
    setNotice("");
  };
  const load = async () => {
    const [settings, existing] = await Promise.all([
      supabase.rpc("creator_tier_setup"),
      supabase.from("trainer_programs").select("id,title").eq("trainer_id", trainerId),
    ]);
    if (settings.error) throw settings.error;
    const result = settings.data as unknown as { policy: Policy; tiers: Tier[] };
    const saved = result.tiers ?? [];
    setTiers(saved);
    if (result.policy) setPolicy(result.policy);
    if (!existing.error) setPrograms(existing.data ?? []);
    return saved;
  };
  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.rpc("creator_tier_setup"),
      supabase.from("trainer_programs").select("id,title").eq("trainer_id", trainerId),
    ]).then(([settings, existing]) => {
      if (!active) return;
      if (settings.error) {
        setError(settings.error.message);
      } else {
        const result = settings.data as unknown as { policy: Policy; tiers: Tier[] };
        const saved = result.tiers ?? [];
        setTiers(saved);
        if (result.policy) setPolicy(result.policy);
        const first = saved.find((tier) => tier.tier_no === 1);
        if (first) {
          setTitle(first.title);
          setDescription(first.description);
          setPrice((first.price_cents / 100).toFixed(2));
          setBenefits(first.benefits);
        }
      }
      if (!existing.error) setPrograms(existing.data ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [trainerId]);

  const amount = Math.round(Number(price) * 100);
  const hasLive = benefits.scheduledLives || benefits.memberOnlyLives;
  const requiredPrice = !hasLive ? 50
    : benefits.liveClassesPerMonth === -1 ? policy.unlimited_min_cents
    : benefits.liveClassesPerMonth === 8 ? policy.eight_class_min_cents
    : policy.four_class_min_cents;
  const invalidPrice = !Number.isFinite(amount) || amount < requiredPrice || amount > 1000000;
  const invalidPrograms = benefits.programAccess === "selected" && !benefits.selectedProgramIds.length;
  const invalidBenefits = (hasLive && benefits.liveClassesPerMonth === 0)
    || (!hasLive && benefits.liveClassesPerMonth !== 0);
  const revenueShare = hasLive ? 80 : 90;
  const toggle = (key: "scheduledLives" | "memberOnlyLives" | "memberVideos" | "earlyAccess" | "trybePosts") => {
    setBenefits((previous) => {
      const next = { ...previous, [key]: !previous[key] };
      const live = next.scheduledLives || next.memberOnlyLives;
      next.liveClassesPerMonth = live
        ? previous.liveClassesPerMonth === 0 ? 4 : previous.liveClassesPerMonth
        : 0;
      return next;
    });
  };
  const save = async () => {
    if (!title.trim() || invalidPrice || invalidPrograms || invalidBenefits) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await supabase.rpc("save_creator_tier_draft", {
        p_tier: current,
        p_title: title.trim(),
        p_description: description,
        p_price: amount,
        p_benefits: benefits,
      });
      if (saved.error) throw saved.error;
      const newTiers = await load();
      selectTier(current, newTiers);
      setStep(3);
      setNotice(`Tier ${current} saved as a draft. It is not yet available for paid checkout.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!tiers.some((tier) => tier.tier_no === current) ||
        !window.confirm(`Delete draft tier ${current}? No customer subscriptions will be changed.`)) return;
    setBusy(true);
    setError("");
    try {
      const deleted = await supabase.rpc("delete_creator_tier_draft", { p_tier: current });
      if (deleted.error) throw deleted.error;
      const remaining = await load();
      selectTier(remaining[0]?.tier_no ?? 1, remaining);
      setNotice("Membership draft deleted.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <section className="card p-5" role="status">Loading membership tiers…</section>;
  return (
    <section className="card my-5 space-y-5 p-5" aria-label="Membership tier setup wizard">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Build your membership tiers</h2>
        <p className="text-sm text-muted-foreground">
          Create up to three plans with your own price and benefits. Your plans are saved as drafts;
          paid tier checkout is not active until Tryumph completes payment and access testing.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2" aria-label="Membership tiers">
        {[1, 2, 3].map((number) => {
          const saved = tiers.find((tier) => tier.tier_no === number);
          return <button key={number} type="button"
            aria-pressed={current === number}
            onClick={() => selectTier(number)}
            className={`rounded-lg border p-3 text-left text-sm ${current === number ? "border-primary bg-primary/10" : "border-border"}`}>
            <strong>Tier {number}</strong>
            <span className="mt-1 block text-xs text-muted-foreground">{saved ? saved.title : "New draft"}</span>
          </button>;
        })}
      </div>
      <div className="flex items-center gap-2 text-xs" aria-label="Wizard steps">
        {(["1. Basics", "2. Benefits", "3. Review"] as const).map((label, i) =>
          <span key={label} className={`rounded px-2 py-1 ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{label}</span>
        )}
      </div>
      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Tier name
            <input className="field mt-1" maxLength={120} required value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="All Access" />
          </label>
          <label className="block text-sm font-semibold">What members receive
            <textarea className="field mt-1" maxLength={3000} rows={3} value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell subscribers what makes this tier special" />
          </label>
          <label className="block text-sm font-semibold">Monthly price (USD)
            <input className="field mt-1" type="number" min="0.50" max="10000" step="0.01"
              value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <p className="text-xs text-muted-foreground">Higher-cost live benefits have minimum monthly prices. You'll see those on the next step.</p>
          <button type="button" className="btn btn-primary" disabled={!title.trim() || !Number.isFinite(amount) || amount < 50}
            onClick={() => setStep(2)}>Next: Choose benefits</button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="font-semibold">What should this tier include?</h3>
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-2 font-semibold">Live workouts</legend>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={benefits.scheduledLives}
                onChange={() => toggle("scheduledLives")} />
              Included scheduled live classes
            </label>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={benefits.memberOnlyLives}
                onChange={() => toggle("memberOnlyLives")} />
              Exclusive members-only live classes
            </label>
            {hasLive && <>
              <p className="text-sm font-semibold">Included live attendances per month</p>
              {([
                { value: 4, label: "4 classes", minimum: policy.four_class_min_cents },
                { value: 8, label: "8 classes", minimum: policy.eight_class_min_cents },
                { value: -1, label: "Unlimited eligible classes", minimum: policy.unlimited_min_cents },
              ] as const).map((option) =>
                <label key={option.value} className="flex justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="radio" name="creator-live-count" value={option.value}
                      checked={benefits.liveClassesPerMonth === option.value}
                      disabled={amount < option.minimum}
                      onChange={() => setBenefits((previous) => ({ ...previous, liveClassesPerMonth: option.value }))}/>
                    {option.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {amount < option.minimum ? "Locked · " : ""}{dollars(option.minimum)} min
                  </span>
                </label>
              )}
              <p className="text-xs text-muted-foreground">
                Live-inclusive memberships use an 80% trainer / 20% Tryumph split after payment fees.
                Included lives replace individual drop-in payments for those attendances, which may reduce
                per-class earnings but add recurring membership value.
              </p>
            </>}
          </fieldset>
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-2 font-semibold">Programs</legend>
            <label className="block text-sm">Program access
              <select className="field mt-1" value={benefits.programAccess}
                onChange={(e) => {
                  const programAccess = e.target.value as Benefits["programAccess"];
                  setBenefits((old) => ({ ...old, programAccess,
                    selectedProgramIds: programAccess === "selected" ? old.selectedProgramIds : [],
                    autoIncludeNewPrograms: programAccess === "all" && old.autoIncludeNewPrograms }));
                }}>
                <option value="none">No programs included</option>
                <option value="all">All eligible programs</option>
                <option value="selected">Only programs I select</option>
              </select>
            </label>
            {benefits.programAccess === "all" && (
              <label className="flex gap-2 text-sm">
                <input type="checkbox" checked={benefits.autoIncludeNewPrograms}
                  onChange={() => setBenefits((b) => ({ ...b, autoIncludeNewPrograms: !b.autoIncludeNewPrograms }))}/>
                Automatically include new eligible programs
              </label>
            )}
            {benefits.programAccess === "selected" && (
              <div className="space-y-2">
                {!programs.length && <p className="text-sm text-muted-foreground">Create a program in Trainer Studio before selecting it for this tier.</p>}
                {programs.map((program) => (
                  <label key={program.id} className="flex gap-2 text-sm">
                    <input type="checkbox" checked={benefits.selectedProgramIds.includes(program.id)}
                      onChange={() => setBenefits((b) => ({ ...b, selectedProgramIds:
                        b.selectedProgramIds.includes(program.id)
                          ? b.selectedProgramIds.filter((id) => id !== program.id)
                          : [...b.selectedProgramIds, program.id] }))}/>
                    {program.title}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="space-y-2 rounded-lg border p-4">
            <legend className="px-2 font-semibold">Videos & community</legend>
            {([
              ["memberVideos", "Subscriber-only videos"],
              ["earlyAccess", "Early access to videos"],
              ["trybePosts", "Members-only Trybe posts"],
            ] as const).map(([key, label]) =>
              <label key={key} className="flex gap-2 text-sm">
                <input type="checkbox" checked={benefits[key]} onChange={() => toggle(key)} />{label}
              </label>
            )}
          </fieldset>
          {invalidPrice && hasLive && (
            <p role="alert" className="text-sm text-destructive">
              The selected live allowance requires at least {dollars(requiredPrice)}/month.
              Increase the tier price on the Basics step or choose a lower allowance.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="btn btn-primary"
              disabled={invalidPrice || invalidPrograms || invalidBenefits} onClick={() => setStep(3)}>
              Review membership
            </button>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="font-semibold">{title || "Untitled"} · {dollars(amount)} / month</h3>
          <p className="text-sm whitespace-pre-wrap">{description}</p>
          <div className="rounded-lg border p-4 text-sm space-y-2">
            <p><strong>Live:</strong> {hasLive ?
              `${benefits.liveClassesPerMonth === -1 ? "Unlimited eligible" : benefits.liveClassesPerMonth} classes per month · ${[
                benefits.scheduledLives ? "scheduled" : "",
                benefits.memberOnlyLives ? "members-only" : "",
              ].filter(Boolean).join(" and ")}` : "Not included"}</p>
            <p><strong>Programs:</strong> {benefits.programAccess === "selected"
              ? `${benefits.selectedProgramIds.length} selected` : benefits.programAccess}</p>
            <p><strong>Videos:</strong> {[benefits.memberVideos && "subscriber-only",
              benefits.earlyAccess && "early access"].filter(Boolean).join(", ") || "Not included"}</p>
            <p><strong>Community:</strong> {benefits.trybePosts ? "Members-only Trybe posts" : "Not included"}</p>
            <p><strong>Revenue split:</strong> {revenueShare}% trainer / {100 - revenueShare}% Tryumph after payment-processing fees</p>
            {hasLive && <p className="text-xs text-muted-foreground">
              Including live classes may reduce drop-in income for subscribing members.
              Unlimited live access covers only your eligible sessions, not private coaching.
            </p>}
          </div>
          <p className="text-sm text-muted-foreground">
            This saves your configuration as a draft. It does not activate Stripe billing or
            grant access to paid benefits. Tryumph must complete tier-aware checkout and usage tests first.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>Back to benefits</button>
            <button type="button" className="btn btn-primary"
              disabled={busy || invalidPrice || invalidPrograms || invalidBenefits || !title.trim()}
              onClick={() => void save()}>{busy ? "Saving…" : "Save tier draft"}</button>
            {tiers.some((tier) => tier.tier_no === current) &&
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void remove()}>
                Delete draft
              </button>}
          </div>
        </div>
      )}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
