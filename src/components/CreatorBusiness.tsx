import { CATEGORIES } from "@/lib/data";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { TrainerWelcomeGuides, trainerWelcomeMatch } from "./TrainerWelcomeGuides";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import { discoveryLabels } from "@/lib/discovery";
import type { Tables } from "@/integrations/supabase/types";
const fail = (e: unknown) =>
  toast.error(e instanceof Error ? e.message : "Action unavailable");
const money = (n: number) =>
  (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export function WorkWithMe({ trainerId }: { trainerId: string }) {
  const me = useUserId(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <section className="card my-4 p-5">
      <h2 className="text-xl font-bold">Work With Me</h2>
      <p>
        For professional collaborations and partnerships. This inquiry stays
        separate from personal messages.
      </p>
      {!me ? (
        <Link to="/account" className="btn btn-outline mt-3">
          Sign in to inquire
        </Link>
      ) : (
        me !== trainerId && (
          <button
            className="btn btn-outline mt-3"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            Professional inquiry
          </button>
        )
      )}
      {open && (
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await supabase.rpc("submit_creator_partnership", {
                p_trainer: trainerId,
                p_name: String(form.get("name")),
                p_organization: String(form.get("organization")),
                p_email: String(form.get("email")),
                p_type: String(form.get("type")),
                p_description: String(form.get("description")),
                p_budget: String(form.get("budget")),
                p_timeline: String(form.get("timeline")),
              });
              if (r.error) throw r.error;
              setOpen(false);
              toast.success("Inquiry sent privately to the trainer");
            } catch (e) {
              fail(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="grid gap-3">
            {[
              ["name", "Your name", 120],
              ["organization", "Business or organization", 160],
              ["email", "Contact email", 254],
              ["type", "Collaboration type", 80],
              ["budget", "Estimated budget (optional)", 160],
              ["timeline", "Proposed timeline (optional)", 160],
            ].map(([name, label, max]) => (
              <label key={name}>
                {" "}
                {label}
                <input
                  className="field"
                  name={String(name)}
                  type={name === "email" ? "email" : "text"}
                  required={!["budget", "timeline"].includes(String(name))}
                  maxLength={Number(max)}
                />
              </label>
            ))}
            <label>
              Project description
              <textarea
                name="description"
                className="field"
                minLength={20}
                maxLength={4000}
                required
              />
            </label>
            <p className="text-xs">
              Your contact details are shared with this trainer. Avoid sensitive
              personal information. Limited to five inquiries per day and one
              per trainer per hour.
            </p>
            <button className="btn btn-primary">
              {busy ? "Sending…" : "Send inquiry"}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
export function PartnershipInbox() {
  const me = useUserId(),
    [rows, setRows] = useState<Tables<"creator_partnerships">[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setRows([]);
    if (me)
      void supabase
        .from("creator_partnerships")
        .select("*")
        .eq("trainer_id", me)
        .order("created_at", { ascending: false })
        .limit(100)
        .then((r) => {
          if (active) {
            if (r.error) setError("Partnership inbox unavailable");
            else {
              setRows(r.data);
              setError("");
            }
          }
        });
    return () => {
      active = false;
    };
  }, [me]);
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-xl font-bold">Partnerships</h2>
      {error && <p role="alert">{error}</p>}
      {!error && !rows.length && <p>No professional inquiries yet.</p>}
      {rows.map((r) => (
        <article key={r.id} className="rounded border p-4 space-y-2">
          <h3 className="font-bold">
            {r.organization} · {r.collaboration}
          </h3>
          <p>
            {r.name} ·{" "}
            <a href={`mailto:${r.email}`} className="underline">
              {r.email}
            </a>
          </p>
          <p className="whitespace-pre-wrap">{r.description}</p>
          <p>
            {r.budget && `Budget: ${r.budget}`}{" "}
            {r.timeline && `Timeline: ${r.timeline}`}
          </p>
          <label>
            Inquiry status
            <select
              className="field"
              value={r.status}
              disabled={busy}
              onChange={async (e) => {
                const status = e.target.value;
                setBusy(true);
                try {
                  const result = await supabase.rpc(
                    "update_creator_partnership",
                    { p_id: r.id, p_status: status },
                  );
                  if (result.error) throw result.error;
                  setRows((v) =>
                    v.map((x) => (x.id === r.id ? { ...x, status } : x)),
                  );
                } catch (e) {
                  fail(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {["new", "discussion", "accepted", "declined", "archived"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v === "discussion" ? "In Discussion" : v}
                  </option>
                ),
              )}
            </select>
          </label>
          <time className="text-xs">
            {new Date(r.created_at).toLocaleString()}
          </time>
        </article>
      ))}
    </section>
  );
}
type BusinessMetrics = {
  followers: number;
  newFollowers: number;
  unfollows: number;
  videoViews: number;
  periodViews: number;
  reportedWatchSeconds: number | null;
  measurement: string;
  trybeMembers: number;
  newTrybeMembers: number;
  subscribers: number;
  earnings: Record<string, number>;
  totalEarned: number;
  pendingTransfers: number;
  completedTransfers: number;
  unreadMessages: number;
  newPartnerships: number;
};
export function CreatorAnalytics() {
  const me = useUserId(),
    [period, setPeriod] = useState("30"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [metrics, setMetrics] = useState<BusinessMetrics | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setMetrics(null);
    setError("");
    const until =
      period === "custom" ? new Date(`${end}T23:59:59`) : new Date();
    const since =
      period === "custom"
        ? new Date(`${start}T00:00:00`)
        : new Date(until.getTime() - Number(period) * 86400000);
    if (
      !Number.isFinite(since.getTime()) ||
      !Number.isFinite(until.getTime()) ||
      since >= until
    ) {
      setError("Choose a valid start and end date.");
      return;
    }
    void supabase
      .rpc("creator_business_metrics", {
        p_start: since.toISOString(),
        p_end: until.toISOString(),
      })
      .then((r) => {
        if (active) {
          if (r.error) setError(r.error.message);
          else setMetrics(r.data as unknown as BusinessMetrics);
        }
      });
    return () => {
      active = false;
    };
  }, [period, start, end, me]);
  const items = metrics
    ? [
        ["Total followers", metrics.followers],
        ["New follows", metrics.newFollowers],
        ["Unfollows", metrics.unfollows],
        ["Net follower growth", metrics.newFollowers - metrics.unfollows],
        ["Video playback starts since rollout", metrics.videoViews],
        ["Playback starts in period", metrics.periodViews],
        ["Trybe members", metrics.trybeMembers],
        ["New Trybe members", metrics.newTrybeMembers],
        ["Active paying subscribers", metrics.subscribers],
        ["Unread messages", metrics.unreadMessages],
        ["New partnerships", metrics.newPartnerships],
      ]
    : [];
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Business analytics</h2>
      <label>
        Reporting period
        <select
          className="field"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {["7", "30", "90", "custom"].map((p) => (
            <option key={p} value={p}>
              {p === "custom" ? "Custom dates" : `Last ${p} days`}
            </option>
          ))}
        </select>
      </label>
      {period === "custom" && (
        <div className="flex flex-wrap gap-3">
          <label>
            From
            <input
              type="date"
              className="field"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              className="field"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {!metrics && !error && <p role="status">Loading your business…</p>}
      {metrics && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {items.map(([label, value]) => (
              <div className="card p-4" key={label}>
                <p className="text-sm">{label}</p>
                <strong className="text-2xl">{value}</strong>
              </div>
            ))}
          </div>
          <h3 className="text-xl font-bold">Trainer earnings after fees</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ["Subscriptions", "subscription"],
              ["Live drop-ins", "live"],
              ["Private sessions", "oneonone"],
              ["Hosted programs", "program"],
              ["Eligible water-break ads", "ads"],
            ].map(([label, key]) => (
              <div className="card p-4" key={key}>
                {label}
                <p className="text-2xl font-bold">
                  {money(metrics.earnings[key!] ?? 0)}
                </p>
              </div>
            ))}
            <div className="card p-4">
              Total earnings
              <p className="text-2xl font-bold">{money(metrics.totalEarned)}</p>
            </div>
            <div className="card p-4">
              Pending net transfers<p>{money(metrics.pendingTransfers)}</p>
            </div>
            <div className="card p-4">
              Completed net transfers<p>{money(metrics.completedTransfers)}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {metrics.measurement} Watch time: unavailable. Independent store and
            affiliate earnings are not tracked by Tryumph.
          </p>
        </>
      )}
    </section>
  );
}
type DemandRow = {
  source: string;
  topic: {
    term: string;
    tags: string[];
    category?: string;
    categories?: string[];
    minMinutes?: number;
    exact?: boolean;
    equipment: string[];
    minutes: number;
    difficulty: string;
  };
  members: number;
  zeroResults: number | null;
  lowResults: number | null;
  averageSupply: number;
};
export function AudienceDemandInsights() {
  const me = useUserId(),
    [days, setDays] = useState(30),
    [tab, setTab] = useState("Trending"),
    [report, setReport] = useState<{
      sufficient: boolean;
      rows: DemandRow[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setReport(null);
    setError("");
    void supabase
      .rpc("creator_demand_insights", {
        p_days: days,
        p_audience: tab === "My Audience",
      })
      .then((r) => {
        if (active) {
          if (r.error) setError(r.error.message);
          else
            setReport(
              r.data as unknown as { sufficient: boolean; rows: DemandRow[] },
            );
        }
      });
    return () => {
      active = false;
    };
  }, [days, tab, me]);
  const rows =
    report?.rows.filter(
      (r) =>
        tab !== "Content Gaps" ||
        r.lowResults !== null ||
        r.zeroResults !== null,
    ) ?? [];
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-2xl font-bold">What Members Are Looking For</h2>
      <p className="text-sm">
        Aggregated signed-in search and filter activity. Complete days only. At
        least 20 different members in the reporting group and 10 per topic are
        required. Sensitive searches are excluded. Counts reflect observed
        demand, not a promise of future sales.
      </p>
      <div
        role="tablist"
        aria-label="Audience demand"
        className="flex flex-wrap gap-2"
      >
        {["Trending", "Content Gaps", "My Audience"].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`chip ${tab === t ? "chip-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <label>
        Reporting period
        <select
          className="field"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[7, 30, 90].map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {!error && !report && (
        <p role="status">Loading privacy-protected insights…</p>
      )}
      {report && (!report.sufficient || !rows.length) && (
        <p role="status">
          Insufficient data to show privacy-protected {tab.toLowerCase()}{" "}
          insights yet.
        </p>
      )}
      {rows.map((r, i) => (
        <article key={i} className="border rounded p-3">
          <h3 className="font-bold">
            {[
              r.topic.term,
              ...(r.topic.categories ??
                (r.topic.category ? [r.topic.category] : [])),
              ...discoveryLabels(r.topic.tags),
              ...r.topic.equipment,
              r.topic.minutes
                ? r.topic.minutes === 999
                  ? "45+ min"
                  : `${r.topic.exact ? "Exactly " : r.topic.minMinutes ? `${r.topic.minMinutes}–` : "Up to "}${r.topic.minutes} min`
                : "",
              r.topic.difficulty,
            ]
              .filter(Boolean)
              .join(" · ")}
          </h3>
          <p>
            {r.source} · {r.members} distinct members · average matching supply{" "}
            {r.averageSupply}
          </p>
          {r.zeroResults !== null && (
            <p>{r.zeroResults} members found zero matching results.</p>
          )}
          {r.lowResults !== null && (
            <p>{r.lowResults} members found three or fewer results.</p>
          )}
        </article>
      ))}
    </section>
  );
}
export function SubscriberLive() {
  const [category, setCategory] = useState("Strength"),
    [level, setLevel] = useState("All levels"),
    [tags, setTags] = useState<string[]>([]),
    [description, setDescription] = useState(""),
    [recording, setRecording] = useState(false);
  const [title, setTitle] = useState(""),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState<string | null>(null);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Go Live Now — subscribers only</h2>
      <p>
        Requires current verified credentials, CPR/AED and payout eligibility.
        No on-demand uploads are required. Subscribers enter without a charge or token.
        Opted-in subscribers are notified when you actually join the room.
      </p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await supabase.rpc("start_subscriber_live", {
              p_title: title,
              p_minutes: 45,
              p_category: category,
              p_level: level,
              p_tags: tags,
              p_description: description,
              p_recording: recording,
            });
            if (r.error) throw r.error;
            setSession(r.data);
          } catch (e) {
            fail(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Session title
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
          />
        </label>
        <label>
          Workout category
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Experience level
          <select
            className="field"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {["All levels", "Beginner", "Intermediate", "Advanced"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Description, equipment and modifications
          <textarea
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={3000}
          />
        </label>
        <DiscoveryFilters value={tags} onChange={setTags} />
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={recording}
            onChange={(e) => setRecording(e.target.checked)}
          />
          Save a private recording for independent review. Subscribers will see
          the recording notice.
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Create subscriber live
        </button>
      </form>
      {session && (
        <p>
          Session created. Use the live class listing to join as host; end it
          with your class controls.{" "}
          <Link to="/live" className="underline">
            Open Live Studio room
          </Link>
        </p>
      )}
    </section>
  );
}
export function CreatorPerks() {
  const me = useUserId(),
    [items, setItems] = useState<Tables<"creator_perks">[]>([]),
    [certs, setCerts] = useState<Tables<"certifications">[]>([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setReady(false);
    if (me)
      void Promise.all([
        supabase
          .from("creator_perks")
          .select("*")
          .eq("published", true)
          .order("category"),
        supabase
          .from("certifications")
          .select("*")
          .eq("user_id", me)
          .eq("status", "verified"),
      ]).then(([p, c]) => {
        if (active) {
          setError(
            p.error || c.error ? "Cannot load perks and credentials" : "",
          );
          setItems(p.data ?? []);
          setCerts(c.data ?? []);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [me]);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Creator Perks</h2>
      <p>
        Real partner benefits for verified trainers. Offers are subject to
        eligibility and expiration; no active discounts are assumed.
      </p>
      {error && <p role="alert">{error}</p>}
      {ready && !items.length && (
        <p>No published partner offers are available to your account.</p>
      )}
      {certs
        .filter((c) => {
          const days = Math.ceil(
            (Date.parse(c.expires) - Date.now()) / 86400000,
          );
          return (
            days <= 60 &&
            !certs.some(
              (n) =>
                n.id !== c.id &&
                n.name.toLowerCase() === c.name.toLowerCase() &&
                Date.parse(n.expires) > Date.parse(c.expires),
            )
          );
        })
        .map((c) => (
          <article key={c.id} className="card p-4">
            <strong>{c.name}</strong>
            <p>
              Expires {c.expires} ·{" "}
              {Math.ceil((Date.parse(c.expires) - Date.now()) / 86400000)} days
              remaining
            </p>
            <p>
              Renew with the issuer, then submit new evidence in Settings for
              independent review. Previous verification decisions are preserved.
            </p>
            {items
              .filter(
                (p) =>
                  p.credential_pattern &&
                  c.name
                    .toLowerCase()
                    .includes(p.credential_pattern.toLowerCase()),
              )
              .map((p) => (
                <p key={p.id}>
                  Related offer: {p.partner} · {p.benefit}
                </p>
              ))}
          </article>
        ))}
      {items.map((p) => (
        <article key={p.id} className="card space-y-2 p-5">
          <p className="text-sm">{p.category}</p>
          <h3 className="text-xl font-bold">{p.partner}</h3>
          <p>{p.description}</p>
          <p>{p.benefit}</p>
          <p>Eligibility: {p.eligibility}</p>
          <p>{p.redemption}</p>
          {p.expires_at && (
            <p>Expires {new Date(p.expires_at).toLocaleDateString()}</p>
          )}
          <p className="text-sm">{p.disclosure}</p>
          {p.url && (
            <a
              className="underline"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
            >
              Partner redemption
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
export function TryumphSchool({ trainerView = false }: { trainerView?: boolean } = {}) {
  const me = useUserId(),
    [items, setItems] = useState<Tables<"school_tutorials">[]>([]),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase
      .from("school_tutorials")
      .select("*")
      .eq("published", true)
      .order("category")
      .order("title")
      .then((r) => {
        if (active) {
          setError(r.error ? "Tutorials unavailable" : "");
          setItems(r.data ?? []);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [me]);
  const welcome = trainerView ? trainerWelcomeMatch(search) : null;
  const hasWelcomeMatch = Boolean(welcome && (welcome.introMatches || welcome.guides.length));
  const visible = items.filter((t) =>
    `${t.title} ${t.category} ${t.instructions}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Tryumph School</h2>
      <label>
        Search tutorials
        <input
          className="field"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {trainerView && <TrainerWelcomeGuides search={search} />}
      {ready && !visible.length && !hasWelcomeMatch && (
        <p>
          No published tutorials match yet. Unfinished guides stay unpublished.
        </p>
      )}
      {visible.map((t) => (
        <details key={t.id} className="card p-5">
          <summary className="font-bold">
            {t.category} · {t.title}
          </summary>
          <p className="whitespace-pre-wrap mt-4">{t.instructions}</p>
          {(t.screenshots as { url: string; alt: string }[]).map((im, i) => (
            <img
              key={i}
              src={im.url}
              alt={im.alt}
              className="mt-3 max-w-full rounded"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ))}
          {t.video_id && (
            <Link
              to="/on-demand"
              search={{ v: t.video_id }}
              className="underline"
            >
              Watch the approved tutorial video
            </Link>
          )}
          <p className="text-xs mt-3">
            Updated {new Date(t.updated_at).toLocaleDateString()}
          </p>
        </details>
      ))}
    </section>
  );
}
export function CreatorProgramAnalytics() {
  const me = useUserId(),
    [items, setItems] = useState<
      {
        id: string;
        title: string;
        enrollments: number;
        starts: number;
        averageProgress: number;
        completionRate: number;
        lessons: {
          title: string;
          edition: number;
          completed: number;
          started: number;
        }[];
      }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.rpc("creator_program_analytics").then((r) => {
      if (active) {
        if (r.error) setError("Program engagement analytics unavailable");
        else
          setItems(
            r.data as unknown as {
              id: string;
              title: string;
              enrollments: number;
              starts: number;
              averageProgress: number;
              completionRate: number;
              lessons: {
                title: string;
                edition: number;
                completed: number;
                started: number;
              }[];
            }[],
          );
      }
    });
    return () => {
      active = false;
    };
  }, [me]);
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-xl font-bold">Program engagement</h2>
      <p className="text-sm">
        Actual enrollment and progress records, including preserved historical
        editions. Starts require a recorded checkpoint or completion. Counts
        include subscription enrollments; no individual activity is exposed.
        Lower lesson completion can identify potential drop-off points, not
        their cause.
      </p>
      {error && <p role="alert">{error}</p>}
      {!error && !items.length && <p>No structured programs yet.</p>}
      {items.map((p) => (
        <details key={p.id}>
          <summary>
            {p.title} · {p.enrollments} enrollments · {p.starts} starts ·{" "}
            {p.averageProgress}% average progress · {p.completionRate}%
            completed
          </summary>
          {p.lessons.map((l, i) => (
            <p key={i}>
              Edition {l.edition} · {l.title}: {l.completed} completions /{" "}
              {l.started} recorded starts
            </p>
          ))}
        </details>
      ))}
    </section>
  );
}
export function CreatorComments() {
  const me = useUserId(),
    [rows, setRows] = useState<Tables<"post_comments">[]>([]),
    [holds, setHolds] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (!me) return;
    const p = await supabase
      .from("posts")
      .select("id")
      .eq("author_id", me)
      .order("created_at", { ascending: false })
      .limit(100);
    if (p.error) {
      setError("Could not load your posts");
      return;
    }
    if (!p.data.length) {
      setRows([]);
      return;
    }
    const [c, h] = await Promise.all([
      supabase
        .from("post_comments")
        .select("*")
        .in(
          "post_id",
          p.data.map((x) => x.id),
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("creator_comment_holds")
        .select("comment_id")
        .eq("trainer_id", me)
        .eq("hidden", true),
    ]);
    setError(c.error || h.error ? "Could not load comments" : "");
    setRows(c.data ?? []);
    setHolds((h.data ?? []).map((x) => x.comment_id));
  };
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);
  return (
    <section className="card p-5 space-y-4">
      <h2 className="text-xl font-bold">Recent community comments</h2>
      <p className="text-sm">
        Latest 100 comments across your latest 100 posts. Hide a comment from
        community readers while retaining its original text and an audit trail.
        Replies appear in the same post discussion.
      </p>
      {error && <p role="alert">{error}</p>}
      {!error && !rows.length && <p>No comments on your recent posts.</p>}
      {rows.map((c) => (
        <article className="border rounded p-3 space-y-2" key={c.id}>
          <strong>
            {c.author_name}
            {holds.includes(c.id) ? " · hidden" : ""}
          </strong>
          <p className="whitespace-pre-wrap">{c.text}</p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const r = await supabase.rpc("moderate_creator_comment", {
                  p_id: c.id,
                  p_hidden: !holds.includes(c.id),
                  p_reason: String(f.get("reason")),
                });
                if (r.error) throw r.error;
                await load();
              } catch (e) {
                fail(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Moderation reason
              <input
                name="reason"
                className="field"
                minLength={3}
                maxLength={500}
                required
              />
            </label>
            <button className="btn btn-outline" disabled={busy}>
              {holds.includes(c.id) ? "Restore comment" : "Hide comment"}
            </button>
          </form>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              setBusy(true);
              try {
                const r = await supabase.rpc("reply_creator_comment", {
                  p_id: c.id,
                  p_text: String(f.get("reply")),
                });
                if (r.error) throw r.error;
                form.reset();
                await load();
              } catch (e) {
                fail(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Reply
              <input
                name="reply"
                className="field"
                minLength={1}
                maxLength={1000}
                required
              />
            </label>
            <button className="btn btn-outline" disabled={busy}>
              Reply in discussion
            </button>
          </form>
        </article>
      ))}
    </section>
  );
}
export function TrainerUpcomingLives({ trainerId }: { trainerId: string }) {
  const [items, setItems] = useState<Tables<"discoverable_lives">[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItems([]);
    void supabase
      .from("discoverable_lives")
      .select("*")
      .eq("trainer_id", trainerId)
      .gte("starts_at", new Date(Date.now() - 3 * 3600000).toISOString())
      .order("starts_at")
      .limit(8)
      .then((r) => {
        if (active) {
          setError(r.error ? "Live schedule unavailable" : "");
          setItems(
            (r.data ?? []).filter(
              (l) =>
                l.starts_at &&
                l.minutes &&
                Date.parse(l.starts_at) + l.minutes * 60000 > Date.now(),
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [trainerId]);
  return error ? (
    <p role="status">{error}</p>
  ) : items.length ? (
    <section className="card my-4 p-5 space-y-3">
      <h2 className="text-xl font-bold">Live with this trainer</h2>
      {items.map((l) => (
        <article key={l.id}>
          <h3 className="font-semibold">
            {l.status === "live" ? "Live now · " : ""}
            {l.title}
          </h3>
          <p>
            {l.starts_at && new Date(l.starts_at).toLocaleString()} ·{" "}
            {l.session_type === "subscriber"
              ? "Subscribers only"
              : "$5 drop-in · included for this trainer’s subscribers"}
          </p>
        </article>
      ))}
      <Link to="/live" className="btn btn-outline">
        View classes and join
      </Link>
    </section>
  ) : null;
}
