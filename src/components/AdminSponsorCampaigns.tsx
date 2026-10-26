import { useEffect, useState } from "react";
import {
  listSponsorCampaigns,
  saveSponsorCampaign,
} from "@/lib/sponsor-admin.functions";
import { toast } from "sonner";

type Campaign = {
  id: string;
  title: string;
  creative_url: string;
  destination_url: string;
  creative_type: "image" | "video";
  active: boolean;
};
export function AdminSponsorCampaigns() {
  const [rows, setRows] = useState<Campaign[]>([]),
    [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""),
    [creativeUrl, setCreativeUrl] = useState(""),
    [destinationUrl, setDestinationUrl] = useState("");
  const [creativeType, setCreativeType] = useState<"image" | "video">("image");
  const load = async () => {
    try {
      setRows((await listSponsorCampaigns()) as Campaign[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot load campaigns");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      await saveSponsorCampaign({
        data: {
          title,
          creativeUrl,
          destinationUrl,
          creativeType,
          active: false,
        },
      });
      toast.success(
        "Campaign saved as inactive; activate after sponsor approval and billing setup",
      );
      setTitle("");
      setCreativeUrl("");
      setDestinationUrl("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cannot save campaign");
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (c: Campaign) => {
    try {
      await saveSponsorCampaign({
        data: {
          id: c.id,
          title: c.title,
          creativeUrl: c.creative_url,
          destinationUrl: c.destination_url,
          creativeType: c.creative_type,
          active: !c.active,
        },
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update campaign");
    }
  };
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Water-break sponsor campaigns</h2>
      <p className="text-sm text-muted-foreground">
        Direct-sold sponsor media plays during marked water breaks only.
        Reported impressions do not generate earnings; signed settlement events
        do.
      </p>
      <input
        className="field"
        placeholder="Sponsor name"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="field"
        type="url"
        placeholder="https://cdn.example.com/creative.mp4"
        value={creativeUrl}
        onChange={(e) => setCreativeUrl(e.target.value)}
      />
      <input
        className="field"
        type="url"
        placeholder="https://sponsor.example.com/"
        value={destinationUrl}
        onChange={(e) => setDestinationUrl(e.target.value)}
      />
      <select
        className="field"
        value={creativeType}
        onChange={(e) => setCreativeType(e.target.value as "image" | "video")}
      >
        <option value="image">Image creative</option>
        <option value="video">Video creative</option>
      </select>
      <button
        className="btn btn-primary"
        disabled={busy || !title || !creativeUrl || !destinationUrl}
        onClick={() => void save()}
      >
        Add sponsor campaign
      </button>
      <ul className="space-y-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded border p-2 text-sm"
          >
            <span className="flex-1">
              {c.title} · {c.creative_type} · {c.active ? "Active" : "Inactive"}
            </span>
            <button className="btn btn-outline" onClick={() => void toggle(c)}>
              {c.active ? "Pause" : "Activate"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
