import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { getFounderHQSnapshot } from "@/lib/founder-hq.functions";

type Snapshot = Awaited<ReturnType<typeof getFounderHQSnapshot>>;

export function FounderHQ() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSnapshot(await getFounderHQSnapshot());
    } catch (cause) {
      setSnapshot(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load the founder overview",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reviews = snapshot
    ? [
        {
          name: "Credential applications",
          count: snapshot.pendingCredentials,
          destination: "hq-certifications",
          detail: "Review uploaded proof before verifying trainers",
        },
        {
          name: "Workout videos",
          count: snapshot.pendingVideos,
          destination: "hq-videos",
          detail: "Check Bunny playback and credentials before approval",
        },
        {
          name: "Safety reports",
          count: snapshot.openReports + snapshot.openAppeals,
          destination: "hq-safety",
          detail: "Open reports and moderation appeals",
        },
        {
          name: "Refund operations",
          count: snapshot.pendingRefunds,
          destination: "hq-operations",
          detail: "Review queued refunds, never trigger payouts automatically",
        },
      ]
    : [];

  const stats = snapshot
    ? [
        {
          label: "Registered profiles",
          value: snapshot.registeredProfiles,
          icon: Users,
        },
        {
          label: "Approved workouts",
          value: snapshot.approvedVideos,
          icon: Video,
        },
        {
          label: "Waitlist signups · 7 days",
          value: snapshot.recentWaitlist,
          icon: ClipboardList,
        },
        {
          label: "Scheduled future lives",
          value: snapshot.upcomingLives,
          icon: CalendarDays,
        },
      ]
    : [];

  return (
    <section
      aria-labelledby="founder-hq-title"
      className="card space-y-5 border-primary/40 p-5 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Owner-only overview · read-only</p>
          <h2 id="founder-hq-title" className="text-2xl font-bold">
            Tryumph HQ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real database activity and review queues, not estimated metrics.
          </p>
        </div>
        <button
          className="btn btn-outline"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border p-3 text-sm">
          {error}
        </div>
      )}
      {loading && !snapshot && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking your operational queues…
        </p>
      )}
      {snapshot && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg bg-secondary p-4">
                <Icon
                  className="mb-2 h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <div className="text-2xl font-bold tabular-nums">{value}</div>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-lg font-semibold">Needs your review</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {reviews.map((item) => (
                <div key={item.name} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold">{item.name}</h4>
                    <span className="chip tabular-nums">
                      {item.count} pending
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                  <button
                    className="btn btn-outline mt-3"
                    onClick={() =>
                      document
                        .getElementById(item.destination)
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    Open review section
                  </button>
                </div>
              ))}
            </div>
            {reviews.every((item) => item.count === 0) && (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing pending in the four review queues right now.
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <h3 className="font-semibold">Feature gates</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Database switches only. An enabled switch does not prove payment,
              media moderation or other external services have been tested.
            </p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {(
                [
                  ["Creator memberships", snapshot.settings.creatorMembershipsEnabled],
                  ["Native program payments", snapshot.settings.nativeProgramPaymentsEnabled],
                  ["Community photos", snapshot.settings.communityPhotosEnabled],
                  ["Community feed ads", snapshot.settings.communityAdsEnabled],
                ] as const
              ).map(([label, enabled]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-2 rounded-md bg-secondary px-3 py-2"
                >
                  <span>{label}</span>
                  <span className={enabled ? "font-medium" : "text-muted-foreground"}>
                    {enabled ? "Enabled in database" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {snapshot.queuedContactRequests > 0 && (
            <p role="status" className="text-sm">
              {snapshot.queuedContactRequests} contact delivery request(s)
              are waiting for processing. Check Resend and server logs before
              retrying anything.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Last checked: {new Date(snapshot.fetchedAt).toLocaleString()}.
            Deployment health, outreach, scheduled social posts, and external
            provider readiness are not connected yet. No automatic action is
            taken from this panel.
          </p>
        </>
      )}
    </section>
  );
}
