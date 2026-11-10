import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import { DiscoveryFilters } from "./DiscoveryFilters";
export function TrainerFocusEditor() {
  const me = useUserId();
  const [tags, setTags] = useState<string[]>([]),
    [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    if (me)
      void supabase
        .from("profiles")
        .select("focus_tags")
        .eq("id", me)
        .single()
        .then((r) => {
          if (active && !r.error) setTags(r.data.focus_tags);
        });
    return () => {
      active = false;
    };
  }, [me]);
  return (
    <section className="card my-5 p-5">
      <h2 className="font-bold">Public self-described areas of focus</h2>
      <p className="text-sm">
        These labels help people find your work. They do not establish medical
        qualifications or replace independently verified credentials. Protected
        professional titles require current reviewed professional evidence.
      </p>
      <DiscoveryFilters editor value={tags} onChange={setTags} />
      <button
        className="btn btn-primary"
        disabled={!me}
        onClick={() =>
          void supabase
            .from("profiles")
            .update({ focus_tags: tags })
            .eq("id", me!)
            .then((r) =>
              setStatus(
                r.error ? r.error.message : "Public focus labels saved",
              ),
            )
        }
      >
        Save focus labels
      </button>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
