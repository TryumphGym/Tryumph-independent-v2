import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase;
type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: string;
  reporter_id: string;
  created_at: string;
  evidence?: string | null;
  review_note: string | null;
};
type Profile = { id: string; name: string; role: string; created_at: string };
type Post = {
  id: string;
  trybe: string;
  author_name: string;
  text: string;
  visibility: string;
  is_hidden: boolean;
  created_at: string;
};
type Comment = {
  id: string;
  post_id: string;
  author_name: string;
  text: string;
  created_at: string;
  is_hidden?: boolean;
};
const LIMIT = 100;

export function AdminSafetyCenter() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [appeals, setAppeals] = useState<
    { id: string; user_id: string; body: string; status: string }[]
  >([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [section, setSection] = useState<
    "reports" | "users" | "trybes" | "comments" | "appeals"
  >("reports");
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const [u, p, c, r, a] = await Promise.all([
      supabase.rpc("admin_profile_directory"),
      supabase
        .from("posts")
        .select("id,trybe,author_name,text,visibility,is_hidden,created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("post_comments")
        .select("id,post_id,author_name,text,created_at,is_hidden")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      db
        .from("content_reports")
        .select(
          "id,target_type,target_id,reason,details,status,reporter_id,created_at,review_note,evidence",
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("moderation_appeals")
        .select("id,user_id,body,status")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ]);
    const failures = [u.error, p.error, c.error, r.error, a.error].filter(
      Boolean,
    );
    setError(
      failures.length
        ? "Some moderation data could not be loaded. Check the admin RLS policies and content_reports SQL migration."
        : "",
    );
    setProfiles(u.data ?? []);
    setPosts(p.data ?? []);
    setComments(c.data ?? []);
    setReports((r.data ?? []) as Report[]);
    setAppeals(a.data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    report: Report,
    status: "reviewing" | "resolved" | "dismissed",
  ) {
    const result = await db.rpc("review_content_report", {
      p_id: report.id,
      p_status: status,
      p_note: note[report.id] ?? report.review_note ?? "",
    });
    if (result.error) return void toast.error("Could not update report.");
    toast.success("Report updated");
    void load();
  }
  async function hidePost(post: Post, hidden: boolean) {
    const result = await supabase.rpc("moderate_trybe_post", {
      p_post_id: post.id,
      p_action: "hide",
      p_value: hidden,
    });
    if (result.error) return void toast.error("Could not moderate this post.");
    void load();
  }
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            Owner safety & community oversight
          </h2>
          <p className="text-sm text-muted-foreground">
            Recent records (up to {LIMIT} each). Private messages are not shown.
            Review access is restricted to admins.
          </p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["reports", "users", "trybes", "comments", "appeals"] as const).map(
          (tab) => (
            <button
              key={tab}
              className={`chip ${section === tab ? "chip-active" : ""}`}
              onClick={() => setSection(tab)}
            >
              {tab === "reports"
                ? `Reports (${reports.filter((x) => x.status === "open").length} open)`
                : tab === "users"
                  ? `Users (${profiles.length})`
                  : tab === "trybes"
                    ? "Trybes & posts"
                    : tab === "comments"
                      ? "Comments"
                      : "Appeals"}
            </button>
          ),
        )}
      </div>
      {section === "users" && (
        <div className="max-h-96 space-y-2 overflow-auto">
          {profiles.map((p) => (
            <div className="border-b py-2 text-sm" key={p.id}>
              <strong>{p.name || "Unnamed user"}</strong> · {p.role} · Joined{" "}
              {new Date(p.created_at).toLocaleDateString()}
              <p className="break-all text-xs text-muted-foreground">{p.id}</p>
              <input
                aria-label={`Reason for action on ${p.name}`}
                className="field"
                value={note[p.id] ?? ""}
                onChange={(e) =>
                  setNote((old) => ({ ...old, [p.id]: e.target.value }))
                }
                placeholder="Required restriction or restoration reason"
              />
              {(["content", "suspended", "restore"] as const).map((scope) => (
                <button
                  key={scope}
                  className="btn btn-outline mt-2 mr-2"
                  disabled={!note[p.id]?.trim()}
                  onClick={() =>
                    void supabase
                      .rpc("restrict_account", {
                        p_id: p.id,
                        p_scope: scope === "restore" ? "content" : scope,
                        p_active: scope !== "restore",
                        p_reason: note[p.id]!,
                      })
                      .then((r) => {
                        if (r.error) toast.error(r.error.message);
                        else toast.success("Account action logged");
                      })
                  }
                >
                  {scope === "restore"
                    ? "Restore account"
                    : scope === "suspended"
                      ? "Suspend sessions and content"
                      : "Restrict content"}
                </button>
              ))}
            </div>
          ))}
          {!profiles.length && (
            <p>
              No visible accounts. Check access policies if you expect users.
            </p>
          )}
        </div>
      )}
      {section === "trybes" && (
        <div className="max-h-[32rem] space-y-2 overflow-auto">
          <p className="text-xs text-muted-foreground">
            Trybe names are derived from recent posts; empty Trybes may not
            appear.
          </p>
          {posts.map((p) => (
            <div className="rounded-md border p-3 text-sm" key={p.id}>
              <p className="font-semibold">
                {p.trybe} · {p.author_name}
              </p>
              <p className="whitespace-pre-wrap break-words">{p.text}</p>
              <p className="text-xs text-muted-foreground">
                {p.visibility} · {p.is_hidden ? "Hidden" : "Visible"}
              </p>
              <button
                className="btn btn-outline mt-2"
                onClick={() => void hidePost(p, !p.is_hidden)}
              >
                {p.is_hidden ? "Unhide post" : "Hide post"}
              </button>
            </div>
          ))}
        </div>
      )}
      {section === "comments" && (
        <div className="max-h-[32rem] space-y-2 overflow-auto">
          {comments.map((c) => (
            <div className="rounded-md border p-3 text-sm" key={c.id}>
              <p className="font-semibold">{c.author_name}</p>
              <p className="break-words">{c.text}</p>
              <input
                aria-label="Comment moderation reason"
                className="field"
                value={note[c.id] ?? ""}
                onChange={(e) =>
                  setNote((old) => ({ ...old, [c.id]: e.target.value }))
                }
                placeholder="Required moderation reason"
              />
              <button
                className="btn btn-outline"
                disabled={!note[c.id]?.trim()}
                onClick={() =>
                  void supabase
                    .rpc("moderate_comment", {
                      p_id: c.id,
                      p_hidden: !c.is_hidden,
                      p_note: note[c.id]!,
                    })
                    .then((r) => {
                      if (r.error) toast.error(r.error.message);
                      else void load();
                    })
                }
              >
                {c.is_hidden ? "Unhide" : "Hide"} comment
              </button>
              <p className="break-all text-xs text-muted-foreground">
                Post {c.post_id} · {new Date(c.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
      {section === "appeals" &&
        appeals.map((a) => (
          <article key={a.id} className="rounded border p-3 text-sm">
            <p>
              {a.user_id} · {a.status}
            </p>
            <p>{a.body}</p>
            <label>
              Review note
              <input
                className="field"
                value={note[a.id] ?? ""}
                onChange={(e) =>
                  setNote((n) => ({ ...n, [a.id]: e.target.value }))
                }
              />
            </label>
            <button
              className="btn btn-outline"
              disabled={!note[a.id]?.trim()}
              onClick={() =>
                void supabase
                  .rpc("review_moderation_appeal", {
                    p_id: a.id,
                    p_status: "resolved",
                    p_note: note[a.id]!,
                  })
                  .then((r) => {
                    if (r.error) toast.error(r.error.message);
                    else void load();
                  })
              }
            >
              Resolve appeal (use Users to restore restriction)
            </button>
          </article>
        ))}
      {section === "reports" && (
        <div className="max-h-[36rem] space-y-3 overflow-auto">
          {reports.map((r) => (
            <div className="rounded-md border p-3 text-sm" key={r.id}>
              <p className="font-semibold">
                {r.target_type} · {r.reason}{" "}
                <span className="chip">{r.status}</span>
              </p>
              <p className="break-words">
                {r.details || "No additional details"}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Target {r.target_id} · Reporter {r.reporter_id} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
              {r.evidence && (
                <blockquote className="mt-2 border-l p-2">
                  Participant-reported evidence: {r.evidence}
                </blockquote>
              )}
              <textarea
                className="field mt-2"
                placeholder="Private review notes"
                value={note[r.id] ?? r.review_note ?? ""}
                onChange={(e) =>
                  setNote((old) => ({ ...old, [r.id]: e.target.value }))
                }
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className="btn btn-outline"
                  onClick={() => void decide(r, "reviewing")}
                >
                  In review
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void decide(r, "resolved")}
                >
                  Resolve
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => void decide(r, "dismissed")}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          {!reports.length && (
            <p className="text-sm text-muted-foreground">
              No submitted reports yet.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
