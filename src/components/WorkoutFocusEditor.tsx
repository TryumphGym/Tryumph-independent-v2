import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import { DiscoveryFilters } from "./DiscoveryFilters";
export function WorkoutFocusEditor({ id }: { id: string }) {
  const me = useUserId(),
    [tags, setTags] = useState<string[]>([]),
    [intensity, setIntensity] = useState(""),
    [notes, setNotes] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (me)
      void supabase
        .from("trainer_videos")
        .select("discovery_tags,intensity,modification_notes")
        .eq("id", id)
        .eq("user_id", me)
        .single()
        .then((r) => {
          if (!active) return;
          if (r.error) setStatus("Metadata unavailable");
          else {
            setTags(r.data.discovery_tags);
            setIntensity(r.data.intensity);
            setNotes(r.data.modification_notes);
          }
        });
    return () => {
      active = false;
    };
  }, [id, me]);
  return (
    <details className="basis-full text-sm font-normal">
      <summary className="cursor-pointer text-primary">
        Edit workout focus and modifications
      </summary>
      <p className="my-2 text-xs">
        Labels describe the workout, not medical qualifications. Published
        program media remains immutable to preserve purchased editions; upload a
        new version when required.
      </p>
      <DiscoveryFilters value={tags} onChange={setTags} editor />
      <label className="block">
        Intensity
        <select
          className="field"
          value={intensity}
          onChange={(e) => setIntensity(e.target.value)}
        >
          <option value="">Not assessed</option>
          {["gentle", "moderate", "challenging"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label className="block">
        Modifications and experience guidance
        <textarea
          className="field"
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy || !me}
        onClick={async () => {
          setBusy(true);
          const r = await supabase
            .from("trainer_videos")
            .update({
              discovery_tags: tags,
              intensity,
              modification_notes: notes,
            })
            .eq("id", id)
            .eq("user_id", me!)
            .select("id");
          setStatus(
            r.error
              ? r.error.message
              : r.data?.length
                ? "Workout labels saved"
                : "No authorized workout was updated",
          );
          setBusy(false);
        }}
      >
        Save workout labels
      </button>
      {status && <p role="status">{status}</p>}
    </details>
  );
}
