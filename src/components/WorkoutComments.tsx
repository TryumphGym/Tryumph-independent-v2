import { useEffect, useState } from "react";
import { useUserId } from "@/lib/community";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
export function WorkoutComments({ videoId }: { videoId?: string }) {
  const me = useUserId();
  return <ViewerComments key={`${me}:${videoId}`} me={me} videoId={videoId} />;
}
function ViewerComments({
  me,
  videoId,
}: {
  me: string | null;
  videoId: string | undefined;
}) {
  const [rows, setRows] = useState<Tables<"workout_comments">[]>([]),
    [owned, setOwned] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    if (!me) return;
    const videos = await supabase
      .from("trainer_videos")
      .select("id")
      .eq("user_id", me);
    if (videos.error) {
      setError("Comments unavailable");
      return;
    }
    const ids = videos.data.map((v) => v.id);
    setOwned(ids);
    if (!videoId && !ids.length) {
      setRows([]);
      return;
    }
    let query = supabase
      .from("workout_comments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    query = videoId ? query.eq("video_id", videoId) : query.in("video_id", ids);
    const r = await query;
    setRows(r.data ?? []);
    setError(r.error ? "Comments unavailable" : "");
  };
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, videoId]);
  const send = async (text: string, video: string, parent?: string) => {
    const r = await supabase.rpc("save_workout_comment", {
      p_video: video,
      p_text: text,
      ...(parent ? { p_parent: parent } : {}),
    });
    if (r.error) throw r.error;
    await load();
  };
  return (
    <section className="card p-4 space-y-3">
      <h3 className="text-xl font-bold">Workout discussion</h3>
      <p className="text-sm">
        Commenting requires this trainer’s Trybe membership and current workout
        access. Premium discussions follow the same access rules as their
        workouts. No medical advice or sensitive personal details, please.
      </p>
      {error && <p role="alert">{error}</p>}
      {!me ? (
        <p>Sign in and join the trainer’s free Trybe to participate.</p>
      ) : (
        <>
          {!rows.length && !error && <p>No comments available.</p>}
          {videoId && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                setBusy(true);
                try {
                  await send(String(new FormData(form).get("text")), videoId);
                  form.reset();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Comment unavailable",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Your comment
                <textarea
                  name="text"
                  className="field"
                  maxLength={1000}
                  minLength={1}
                  required
                />
              </label>
              <button className="btn btn-outline" disabled={busy}>
                Post comment
              </button>
            </form>
          )}
          {rows.map((c) => (
            <article key={c.id} className="rounded border p-3 space-y-2">
              <strong>
                {c.author_name}
                {c.parent_id ? " · reply" : ""}
                {c.hidden ? " · hidden" : ""}
              </strong>
              <p className="whitespace-pre-wrap">{c.text}</p>
              {owned.includes(c.video_id) && (
                <>
                  {!c.parent_id && !c.hidden && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        setBusy(true);
                        try {
                          await send(
                            String(new FormData(form).get("text")),
                            c.video_id,
                            c.id,
                          );
                          form.reset();
                        } catch (e) {
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Reply unavailable",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <label>
                        Reply
                        <textarea
                          name="text"
                          className="field"
                          maxLength={1000}
                          minLength={1}
                          required
                        />
                      </label>
                      <button className="btn btn-outline" disabled={busy}>
                        Reply
                      </button>
                    </form>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        const r = await supabase.rpc(
                          "moderate_workout_comment",
                          {
                            p_id: c.id,
                            p_hidden: !c.hidden,
                            p_reason: String(
                              new FormData(e.currentTarget).get("reason"),
                            ),
                          },
                        );
                        if (r.error) throw r.error;
                        await load();
                      } catch (e) {
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : "Moderation unavailable",
                        );
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
                      {c.hidden ? "Restore" : "Hide"}
                    </button>
                  </form>
                </>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
