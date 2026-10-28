import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase;
export type ReportTarget = "trainer" | "user" | "post" | "comment" | "message";
export function ReportContent({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: ReportTarget;
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate_content");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Please sign in to report content.");
      setBusy(false);
      return;
    }
    const { error } = await db.from("content_reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim().slice(0, 2000),
    });
    setBusy(false);
    if (error)
      return void toast.error(
        "Report could not be submitted. Please try again.",
      );
    toast.success("Report sent to Tryumph's safety review queue.");
    setOpen(false);
    setDetails("");
  };
  return (
    <span className="inline-block">
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <span className="mt-2 block rounded-lg border p-3">
          <label className="block text-xs">
            Why are you reporting this?
            <select
              className="field mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="inappropriate_content">
                Inappropriate content
              </option>
              <option value="harassment">Harassment or bullying</option>
              <option value="unsafe_fitness_advice">
                Unsafe fitness advice
              </option>
              <option value="misrepresentation">
                Misrepresentation or fraud
              </option>
              <option value="spam">Spam or advertising abuse</option>
              <option value="other">Other concern</option>
            </select>
          </label>
          <textarea
            className="field mt-2"
            placeholder="Optional details for our review team"
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <span className="mt-2 flex gap-2">
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy}
              onClick={() => void submit()}
            >
              Submit report
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
