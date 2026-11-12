import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import {
  MEMBERSHIP_POLICY,
  type CreatorOffer,
  type CreatorWorkout,
  type CreatorDashboard,
} from "@/lib/creators";
import {
  saveCreatorOffer,
  getCreatorDashboard,
  subscribeToCreator,
  cancelCreatorSubscription,
  creatorPaymentPortal,
  creatorCheckoutEnabled,
  setCreatorVideoAudience,
  getCreatorVideo,
} from "@/lib/creator.functions";
import { OnDemandPlayer } from "./OnDemandPlayer";
import { CreatorTierWizard } from "./CreatorTierWizard";
const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Membership action failed";
export function CreatorMembership({ trainerId }: { trainerId: string }) {
  const me = useUserId();
  return (
    <CreatorMembershipForViewer
      key={`${me}:${trainerId}`}
      trainerId={trainerId}
      me={me}
    />
  );
}
function CreatorMembershipForViewer({
  trainerId,
  me,
}: {
  trainerId: string;
  me: string | null;
}) {
  const [offer, setOffer] = useState<CreatorOffer | null>(null),
    [enabled, setEnabled] = useState(false),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setOffer(null);
    setConsent(false);
    setError("");
    void Promise.all([
      supabase.rpc("creator_offer_details", { p_trainer: trainerId }),
      creatorCheckoutEnabled(),
    ]).then(([r, on]) => {
      if (active) {
        if (r.error) setError("Membership information unavailable");
        else if (
          r.data &&
          typeof r.data === "object" &&
          !Array.isArray(r.data) &&
          "trainerId" in r.data
        )
          setOffer(r.data as unknown as CreatorOffer);
        setEnabled(on);
      }
    });
    return () => {
      active = false;
    };
  }, [trainerId, me]);
  if (!offer) return error ? <p role="status">{error}</p> : null;
  return (
    <section className="card my-5 space-y-3 p-5">
      <h2 className="text-xl font-bold">{offer.title}</h2>
      <p className="whitespace-pre-wrap">{offer.description}</p>
      <p className="font-bold">
        ${(offer.priceCents / 100).toFixed(2)} / month · optional
      </p>
      <p className="text-sm">{MEMBERSHIP_POLICY}</p>
      {offer.subscribed ? (
        <p>
          Subscriber access is active.{" "}
          <Link className="underline" to="/account">
            Manage your subscriptions
          </Link>
        </p>
      ) : (
        <>
          <p>Free Trybe membership remains available.</p>
          {me && me !== trainerId && offer.enabled && enabled ? (
            <>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                I understand this is an optional monthly subscription that
                renews until cancelled.
              </label>
              <button
                className="btn btn-primary"
                disabled={!consent || busy}
                onClick={() => {
                  setBusy(true);
                  void subscribeToCreator({
                    data: { trainerId, consent: "monthly-auto-renew-v1" },
                  })
                    .then((r) => window.location.assign(r.url))
                    .catch((e) => {
                      setError(msg(e));
                      setBusy(false);
                    });
                }}
              >
                Subscribe to this trainer
              </button>
            </>
          ) : !me ? (
            <Link className="btn btn-outline" to="/account">
              Sign in for optional membership
            </Link>
          ) : (
            <p className="text-sm">
              New paid subscriptions are not active yet. You can still join the
              free community.
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function MemberSubscriptions() {
  const me = useUserId();
  return me ? <MemberSubscriptionsForViewer key={me} me={me} /> : null;
}
function MemberSubscriptionsForViewer({ me }: { me: string }) {
  const [data, setData] = useState<CreatorDashboard | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    void getCreatorDashboard()
      .then(setData)
      .catch(() => setError("Subscription management unavailable"));
  useEffect(() => {
    let active = true;
    setData(null);
    if (me)
      void getCreatorDashboard()
        .then((r) => {
          if (active) setData(r);
        })
        .catch(() => {
          if (active) setError("Subscription management unavailable");
        });
    return () => {
      active = false;
    };
  }, [me]);
  if (!me) return null;
  return (
    <section className="card my-5 space-y-3 p-5">
      <h2 className="text-xl font-bold">My optional trainer memberships</h2>
      <p className="text-sm">{MEMBERSHIP_POLICY}</p>
      {data?.subscriptions.map((s) => (
        <article key={s.id} className="space-y-2 rounded border p-3">
          <Link
            to="/trybes"
            search={{ t: `coach-${s.trainerId}` }}
            className="underline"
          >
            Open trainer Trybe
          </Link>
          <p>
            ${(s.priceCents / 100).toFixed(2)} / month · {s.billingStatus} ·{" "}
            {s.hasAccess ? "Paid access active" : "No current paid access"}
          </p>
          {s.accessUntil && (
            <p>Paid period ends {new Date(s.accessUntil).toLocaleString()}</p>
          )}
          {s.cancelAtPeriodEnd ? (
            <p>
              Renewal cancelled; paid access continues through the eligible paid
              period.
            </p>
          ) : (
            <button
              className="btn btn-outline"
              disabled={busy || s.billingStatus === "canceled"}
              onClick={() => {
                if (
                  !window.confirm(
                    "Cancel future monthly renewal? Your current eligible paid period remains available.",
                  )
                )
                  return;
                setBusy(true);
                void cancelCreatorSubscription({ data: { orderId: s.id } })
                  .then(load)
                  .catch((e) => setError(msg(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Cancel future renewal
            </button>
          )}
        </article>
      ))}
      {data && !data.subscriptions.length && (
        <p>
          No trainer subscriptions. Free Trybes and separately purchased
          programs remain available.
        </p>
      )}
      <button className="btn btn-ghost" onClick={load}>
        Refresh memberships
      </button>
      {!!data?.subscriptions.length && (
        <button
          className="btn btn-outline"
          disabled={busy}
          onClick={() =>
            void creatorPaymentPortal()
              .then((r) => window.location.assign(r.url))
              .catch((e) => setError(msg(e)))
          }
        >
          Manage membership payment method
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function CreatorOfferStudio() {
  const me = useUserId();
  return <CreatorOfferForViewer key={me ?? "signed-out"} me={me} />;
}
function CreatorOfferForViewer({ me }: { me: string | null }) {
  const [data, setData] = useState<CreatorDashboard | null>(null),
    [title, setTitle] = useState("My Trybe membership"),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState("29.99"),
    [limits, setLimits] = useState({
      minimum: 50,
      maximum: 1000000,
      recommended: 2999,
    }),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    void getCreatorDashboard()
      .then(setData)
      .catch((e) => setError(msg(e)));
  useEffect(() => {
    let active = true;
    setData(null);
    setTitle("My Trybe membership");
    setDescription("");
    setPrice("29.99");
    setEnabled(false);
    setError("");
    if (me)
      void Promise.all([
        getCreatorDashboard(),
        supabase.rpc("creator_price_limits"),
      ])
        .then(([r, bounds]) => {
          if (!active) return;
          if (bounds.error) throw new Error("Monthly price bounds unavailable");
          const limits = bounds.data as unknown as {
            minimum: number;
            maximum: number;
            recommended: number;
          };
          setLimits(limits);
          setPrice((limits.recommended / 100).toFixed(2));
          setData(r);
          if (r.offer) {
            setTitle(r.offer.title);
            setDescription(r.offer.description);
            setPrice((r.offer.price_cents / 100).toFixed(2));
            setEnabled(r.offer.enabled);
          }
        })
        .catch((e) => {
          if (active) setError(msg(e));
        });
    return () => {
      active = false;
    };
  }, [me]);
  return (
    <>
      <CreatorTierWizard />
    <section className="card my-5 space-y-3 p-5">
      <h2 className="text-xl font-bold">Legacy single-plan membership settings</h2>
      <p className="text-sm">
        This original single-plan setting is separate from the new tier drafts above.
        Do not enable paid membership checkout until tier-aware Stripe billing,
        access enforcement, and 80/20 live benefit accounting are tested.
        Previously agreed subscription prices and paid periods remain protected.
      </p>
      {data && (
        <p>
          {data.subscribers} active subscribers · $
          {(data.earnedCents / 100).toFixed(2)} allocated trainer earnings · $
          {(data.feesCents / 100).toFixed(2)} actual processing fees
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void saveCreatorOffer({
            data: {
              title,
              description,
              priceCents: Math.round(Number(price) * 100),
              enabled,
            },
          })
            .then(() => {
              setError("");
              load();
            })
            .catch((e) => setError(msg(e)))
            .finally(() => setBusy(false));
        }}
      >
        <label className="block">
          Membership title
          <input
            className="field"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          What subscribers receive
          <textarea
            className="field"
            maxLength={3000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block">
          Monthly price (USD) — ${(limits.recommended / 100).toFixed(2)}{" "}
          recommended, your choice
          <input
            className="field"
            required
            type="number"
            min={limits.minimum / 100}
            max={limits.maximum / 100}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable this paid offering after verification and payout setup
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Save membership offer
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
    </>
  );
}
export function CreatorVideoStudio() {
  const me = useUserId();
  const [videos, setVideos] = useState<
      { id: string; title: string; review_status: string }[]
    >([]),
    [selected, setSelected] = useState(""),
    [audience, setAudience] = useState<"public" | "subscribers" | "early">(
      "subscribers",
    ),
    [date, setDate] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setVideos([]);
    if (me)
      void supabase
        .from("trainer_videos")
        .select("id,title,review_status")
        .eq("user_id", me)
        .eq("access_scope", "program")
        .then((r) => {
          if (active && !r.error) setVideos(r.data);
        });
    return () => {
      active = false;
    };
  }, [me]);
  return (
    <section className="card my-5 space-y-3 p-5">
      <h2 className="text-xl font-bold">Subscriber-first video releases</h2>
      <p className="text-sm">
        Reuse an upload from your protected library. Publication always waits
        for approval; rejected or suspended content never releases. Scheduling
        runs from server time, even when your browser is closed.
      </p>
      <label className="block">
        Protected video
        <select
          className="field"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select a video</option>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} · {v.review_status}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Release mode
        <select
          className="field"
          value={audience}
          onChange={(e) => setAudience(e.target.value as typeof audience)}
        >
          <option value="subscribers">
            Subscribers Only indefinitely / cancel public release
          </option>
          <option value="early">Subscribers First, then Public</option>
          <option value="public">Public immediately after approval</option>
        </select>
      </label>
      {audience === "early" && (
        <label className="block">
          Public release in your local time (
          {Intl.DateTimeFormat().resolvedOptions().timeZone})
          <input
            className="field"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      )}
      <button
        className="btn btn-primary"
        disabled={!selected || (audience === "early" && !date)}
        onClick={() => {
          void setCreatorVideoAudience({
            data: {
              videoId: selected,
              audience,
              ...(audience === "early"
                ? { publicAt: new Date(date).toISOString() }
                : {}),
            },
          })
            .then(() =>
              setError(
                "Release settings saved. Previously public content may already have been copied.",
              ),
            )
            .catch((e) => setError(msg(e)));
        }}
      >
        Save / reschedule release
      </button>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
export function CreatorVideos({ trainerId }: { trainerId: string }) {
  const me = useUserId();
  return (
    <CreatorVideosForViewer
      key={`${me}:${trainerId}`}
      trainerId={trainerId}
      me={me}
    />
  );
}
function CreatorVideosForViewer({
  trainerId,
  me,
}: {
  trainerId: string;
  me: string | null;
}) {
  const [videos, setVideos] = useState<CreatorWorkout[]>([]),
    [media, setMedia] = useState<Awaited<
      ReturnType<typeof getCreatorVideo>
    > | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setVideos([]);
    setMedia(null);
    void supabase
      .rpc("creator_workouts", { p_trainer: trainerId })
      .then((r) => {
        if (active && !r.error)
          setVideos(r.data as unknown as CreatorWorkout[]);
      });
    return () => {
      active = false;
    };
  }, [trainerId, me]);
  return (
    <section className="my-5 space-y-3">
      {videos.length > 0 && (
        <h2 className="text-xl font-bold">Trainer video releases</h2>
      )}
      {media && (
        <OnDemandPlayer
          video={media.video}
          initialUrl={media.url}
          onClose={() => setMedia(null)}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {videos.map((v) => (
          <article className="card space-y-2 p-4" key={v.id}>
            <h3 className="font-bold">{v.title}</h3>
            <p>
              {v.minutes} min · {v.level} · {v.category}
            </p>
            <p className="text-sm">
              {v.isPublic
                ? "Free public workout"
                : v.audience === "early"
                  ? "Early Access"
                  : "Subscribers Only"}
            </p>
            {v.publicAt && !v.isPublic && (
              <p className="text-xs">
                Public release: {new Date(v.publicAt).toLocaleString()}
              </p>
            )}
            <p className="text-xs">
              Equipment: {v.equipment.split("|")[0] || "None specified"}
            </p>
            {v.isPublic ? (
              <Link
                className="btn btn-outline"
                to="/on-demand"
                search={{ v: v.id }}
              >
                Play free workout
              </Link>
            ) : (
              <button
                className="btn btn-outline"
                onClick={() =>
                  void getCreatorVideo({ data: { videoId: v.id } })
                    .then(setMedia)
                    .catch((e) => setError(msg(e)))
                }
              >
                Play subscriber workout
              </button>
            )}
          </article>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
