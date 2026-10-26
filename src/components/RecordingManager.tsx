import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { retryRecordingImport } from "@/lib/recordings.functions";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
export function RecordingManager() {
  const [rows, setRows] = useState<Tables<"live_recordings">[]>([]),
    [busy, setBusy] = useState<string | null>(null);
  const load = async () => {
    const result = await supabase
      .from("live_recordings")
      .select("*")
      .order("created_at", { ascending: false });
    if (!result.error) setRows(result.data);
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Class recordings</h2>
      <p className="text-sm text-muted-foreground">
        Recordings are private until imported and approved. Failed imports can
        be retried without publishing them.
      </p>
      {!rows.length && <p className="text-sm">No class recordings yet.</p>}
      {rows.map((row) => (
        <div
          className="flex items-center gap-3 rounded border p-3 text-sm"
          key={row.egress_id}
        >
          <span className="flex-1">
            {new Date(row.created_at).toLocaleString()} · {row.status} ·{" "}
            {row.import_status === "ready"
              ? "Submitted for review"
              : row.import_status}
          </span>
          {row.status === "completed" && row.import_status !== "ready" && (
            <button
              className="btn btn-outline"
              disabled={busy !== null}
              onClick={() => {
                setBusy(row.egress_id);
                void retryRecordingImport({ data: { egressId: row.egress_id } })
                  .then(() => {
                    toast.success("Recording submitted for approval");
                    return load();
                  })
                  .catch((error) =>
                    toast.error(
                      error instanceof Error ? error.message : "Import failed",
                    ),
                  )
                  .finally(() => setBusy(null));
              }}
            >
              Retry import
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
