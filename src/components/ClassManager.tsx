import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  manageClass,
  listClassRegistrations,
} from "@/lib/session-management.functions";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
export function ClassManager() {
  const [rows, setRows] = useState<Tables<"live_sessions">[]>([]);
  const [registrations, setRegistrations] = useState<
    Record<string, Awaited<ReturnType<typeof listClassRegistrations>>>
  >({});
  const load = async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return;
    const result = await supabase
      .from("live_sessions")
      .select("*")
      .eq("trainer_id", auth.data.user.id)
      .order("starts_at", { ascending: false });
    if (result.error) toast.error("Unable to load classes");
    else setRows(result.data);
  };
  useEffect(() => {
    void load();
  }, []);
  const act = async (
    id: string,
    action: "cancel" | "end" | "edit",
    title?: string,
    description?: string,
    recordingEnabled?: boolean,
  ) => {
    try {
      await manageClass({
        data: {
          id,
          action,
          ...(title ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(recordingEnabled !== undefined ? { recordingEnabled } : {}),
        },
      });
      await load();
      toast.success(
        action === "cancel"
          ? "Class cancelled; paid bookings are queued for refund"
          : "Class updated",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update class",
      );
      await load();
    }
  };
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Your live classes</h2>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No scheduled classes yet.
        </p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="space-y-2 rounded border p-3">
          <p>
            {new Date(row.starts_at).toLocaleString()} · {row.status}
          </p>
          <input
            className="field"
            aria-label="Class title"
            value={row.title}
            onChange={(e) =>
              setRows((old) =>
                old.map((x) =>
                  x.id === row.id ? { ...x, title: e.target.value } : x,
                ),
              )
            }
          />
          <textarea
            className="field"
            aria-label="Class description"
            value={row.description}
            onChange={(e) =>
              setRows((old) =>
                old.map((x) =>
                  x.id === row.id ? { ...x, description: e.target.value } : x,
                ),
              )
            }
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={row.recording_enabled}
              disabled={row.status !== "scheduled"}
              onChange={(e) =>
                setRows((old) =>
                  old.map((x) =>
                    x.id === row.id
                      ? { ...x, recording_enabled: e.target.checked }
                      : x,
                  ),
                )
              }
            />
            Record this community class for review
          </label>
          {row.status === "scheduled" && (
            <>
              <button
                className="btn btn-outline"
                onClick={() =>
                  void act(
                    row.id,
                    "edit",
                    row.title,
                    row.description,
                    row.recording_enabled,
                  )
                }
              >
                Save details
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => void act(row.id, "cancel")}
              >
                Cancel and refund
              </button>
            </>
          )}
          <button
            className="btn btn-outline"
            onClick={() =>
              void listClassRegistrations({ data: { sessionId: row.id } })
                .then((result) =>
                  setRegistrations((old) => ({ ...old, [row.id]: result })),
                )
                .catch((error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Unable to load registrations",
                  ),
                )
            }
          >
            View registrations
          </button>
          {registrations[row.id] && (
            <ul className="text-sm">
              {registrations[row.id]!.length === 0 && (
                <li>No paid registrations.</li>
              )}
              {registrations[row.id]!.map((member) => (
                <li key={member.id}>
                  {member.name} · {member.status}
                  {member.attended ? " · Attended" : ""}
                </li>
              ))}
            </ul>
          )}
          {["scheduled", "live"].includes(row.status) && (
            <button
              className="btn btn-ghost"
              onClick={() => void act(row.id, "end")}
            >
              End class and recording
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
