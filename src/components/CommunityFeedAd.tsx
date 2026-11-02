import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
export function CommunityFeedAd({
  creative,
}: {
  creative: { id: string; title: string; body: string; external_url: string };
}) {
  const me = useUserId(),
    [hidden, setHidden] = useState(
      () =>
        sessionStorage.getItem(`hidden-community-ad:${creative.id}`) === "true",
    ),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("");
  return hidden ? null : (
    <aside
      className="card my-5 space-y-2 border-dashed p-5"
      aria-label="Sponsored advertisement"
    >
      <p className="text-xs font-bold uppercase">Sponsored</p>
      <h3 className="font-bold">{creative.title}</h3>
      <p className="text-sm">{creative.body}</p>
      <a
        className="text-primary underline"
        href={creative.external_url}
        target="_blank"
        rel="sponsored noopener noreferrer"
      >
        Visit sponsor
      </a>
      <div className="flex gap-3 text-xs">
        <button
          onClick={() => {
            sessionStorage.setItem(
              `hidden-community-ad:${creative.id}`,
              "true",
            );
            setHidden(true);
          }}
        >
          Hide advertisement
        </button>
        <button onClick={() => setReport(!report)}>Report advertisement</button>
      </div>
      {report && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!me) return;
            const r = await supabase
              .from("community_ad_reports")
              .insert({ creative_id: creative.id, user_id: me, reason });
            if (r.error)
              toast.error(
                "Report could not be submitted, or you already reported this advertisement.",
              );
            else {
              toast.success("Advertisement report received");
              setHidden(true);
            }
          }}
        >
          <label>
            Reason
            <textarea
              className="field"
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button className="btn btn-outline" disabled={!me}>
            Submit advertisement report
          </button>
        </form>
      )}
    </aside>
  );
}
