import { PrivateVideoPreview } from "./PrivateVideoPreview";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseBreaks, validateBreaks } from "@/lib/adBreaks";
import {
  CATEGORIES,
  LEVELS,
  EQUIPMENT,
  FRIENDLY,
  encodeEquipment,
  gearOf,
  friendlyOf,
} from "@/lib/data";
import { FITNESS_GOALS, goalsOf } from "@/lib/fitness-goals";
import { MultiDropdown } from "./WorkoutFilters";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
export function TrainerWorkoutEditor({ id }: { id: string }) {
  const [video, setVideo] = useState<Tables<"trainer_videos"> | null>(null),
    [timestamps, setTimestamps] = useState(""),
    [busy, setBusy] = useState(false);
  const [required, setRequired] = useState<string[]>([]),
    [optional, setOptional] = useState<string[]>([]),
    [tags, setTags] = useState<string[]>([]),
    [goals, setGoals] = useState<string[]>([]);
  const open = async () => {
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) return;
    const result = await supabase
      .from("trainer_videos")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.data.user.id)
      .single();
    if (result.error) return void toast.error("Unable to load workout");
    setRequired(
      result.data.required_equipment ?? gearOf(result.data.equipment),
    );
    setOptional(result.data.optional_equipment ?? []);
    setTags(friendlyOf(result.data));
    setGoals(goalsOf(result.data));
    setVideo(result.data);
    setTimestamps(
      result.data.breaks
        .map((n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`)
        .join(", "),
    );
  };
  const save = async () => {
    if (!video) return;
    const breaks = parseBreaks(timestamps);
    const error = validateBreaks(breaks, video.minutes);
    if (error) return void toast.error(error);
    if (
      video.spotify_url &&
      !/^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/.test(
        video.spotify_url,
      )
    )
      return void toast.error("Use a Spotify playlist link");
    setBusy(true);
    const result = await supabase
      .from("trainer_videos")
      .update({
        title: video.title.trim(),
        description: video.description,
        minutes: video.minutes,
        category: video.category,
        level: video.level,
        equipment: encodeEquipment(required, tags, goals),
        required_equipment: required,
        optional_equipment: optional,
        pregnancy_safe: video.pregnancy_safe,
        spotify_url: video.spotify_url,
        breaks,
      })
      .eq("id", id)
      .select("id");
    setBusy(false);
    if (result.error || !result.data?.length)
      return void toast.error("Could not save workout");
    toast.success("Changes submitted for review");
    setVideo(null);
  };
  return (
    <div>
      <PrivateVideoPreview id={id} />
      <button className="btn btn-ghost" onClick={() => void open()}>
        Edit workout
      </button>
      {video && (
        <div className="space-y-2 rounded border p-3">
          <label className="block text-sm">
            Title
            <input
              className="field"
              value={video.title}
              maxLength={160}
              onChange={(e) => setVideo({ ...video, title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              className="field"
              value={video.description}
              maxLength={4000}
              onChange={(e) =>
                setVideo({ ...video, description: e.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            Duration (minutes)
            <input
              type="number"
              min={1}
              max={300}
              className="field"
              value={video.minutes}
              onChange={(e) =>
                setVideo({ ...video, minutes: Number(e.target.value) })
              }
            />
          </label>
          <label className="block text-sm">
            Style
            <select
              className="field"
              value={video.category}
              onChange={(e) => setVideo({ ...video, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Level
            <select
              className="field"
              value={video.level}
              onChange={(e) => setVideo({ ...video, level: e.target.value })}
            >
              {LEVELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <MultiDropdown
            label="Required equipment"
            values={required}
            options={EQUIPMENT.filter((x) => x !== "No equipment")}
            emptyLabel="No equipment required"
            onChange={(values) => {
              setRequired(values);
              setOptional((old) => old.filter((x) => !values.includes(x)));
            }}
          />
          <MultiDropdown
            label="Optional equipment"
            values={optional}
            options={EQUIPMENT.filter((x) => x !== "No equipment")}
            emptyLabel="None"
            onChange={(values) => {
              setOptional(values);
              setRequired((old) => old.filter((x) => !values.includes(x)));
            }}
          />
          <MultiDropdown
            label="Safety tags"
            values={tags}
            options={FRIENDLY}
            emptyLabel="No tags"
            onChange={setTags}
          />
          <MultiDropdown
            label="Fitness goals"
            values={goals}
            options={FITNESS_GOALS}
            emptyLabel="Choose goals"
            onChange={setGoals}
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={video.pregnancy_safe}
              onChange={(e) =>
                setVideo({ ...video, pregnancy_safe: e.target.checked })
              }
            />
            Pregnancy safe
          </label>
          <label className="block text-sm">
            Spotify playlist
            <input
              type="url"
              className="field"
              value={video.spotify_url ?? ""}
              onChange={(e) =>
                setVideo({ ...video, spotify_url: e.target.value || null })
              }
            />
          </label>
          <label className="block text-sm">
            Water breaks (minutes:seconds)
            <input
              className="field"
              value={timestamps}
              onChange={(e) => setTimestamps(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Editing a published workout sends it back for approval.
          </p>
          <button
            className="btn btn-primary"
            disabled={busy || !video.title.trim()}
            onClick={() => void save()}
          >
            Submit changes
          </button>
          <button className="btn btn-ghost" onClick={() => setVideo(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
