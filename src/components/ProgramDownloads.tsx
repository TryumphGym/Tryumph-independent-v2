import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  registerProgramAsset,
  getProgramDownload,
  previewProgramAsset,
  reviewProgramAsset,
} from "@/lib/program-assets.functions";
import { useUserId } from "@/lib/community";
import type { Tables } from "@/integrations/supabase/types";
const failure = (e: unknown) =>
  toast.error(e instanceof Error ? e.message : "File action failed");
export function ProgramDownloadEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const me = useUserId(),
    [items, setItems] = useState<Tables<"program_assets">[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItems([]);
    if (me)
      void supabase
        .from("program_assets")
        .select("*")
        .eq("trainer_id", me)
        .order("created_at", { ascending: false })
        .then((r) => {
          if (!active) return;
          if (r.error) setError("Cannot load private files");
          else {
            setItems(r.data);
            setError("");
          }
        });
    return () => {
      active = false;
    };
  }, [me]);
  const upload = async (file?: File) => {
    if (!file || !me) return;
    if (file.size > 10485760 || file.type !== "application/pdf")
      return void toast.error("Use a plain PDF up to 10 MB");
    setBusy(true);
    try {
      const path = `${me}/${crypto.randomUUID()}.pdf`;
      const r = await supabase.storage
        .from("program-downloads")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (r.error) throw r.error;
      await registerProgramAsset({
        data: { path, title: file.name.replace(/\.pdf$/i, "").slice(0, 160) },
      });
      const rows = await supabase
        .from("program_assets")
        .select("*")
        .eq("trainer_id", me)
        .order("created_at", { ascending: false });
      if (rows.error) throw rows.error;
      setItems(rows.data);
      toast.success(
        "Private PDF submitted for independent review. Select it below to include it in this draft.",
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <fieldset className="card space-y-3 p-4" disabled={busy}>
      <legend className="font-semibold">Private downloadable guides</legend>
      <p className="text-sm">
        Plain PDFs only, up to 10 MB. Submitted evidence is immutable. An
        independent administrator must review each file before publication.
        Files are delivered only through expiring links to authorized members;
        downloaded copies cannot be recalled. Do not upload scripts or sensitive
        personal information.
      </p>
      <label>
        Upload PDF
        <input
          type="file"
          className="field"
          accept="application/pdf"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {items.map((a) => (
        <label key={a.id} className="flex gap-2">
          <input
            type="checkbox"
            checked={value.includes(a.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, a.id]
                  : value.filter((id) => id !== a.id),
              )
            }
          />
          {a.title} · {a.review_status}
        </label>
      ))}
    </fieldset>
  );
}
export function ProgramDownloads({
  ids,
  editionId,
}: {
  ids: string[];
  editionId: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  return ids.length > 0 ? (
    <section className="card space-y-3 p-4" aria-label="Included guides">
      <h3 className="font-semibold">Included guides</h3>
      <p className="text-sm">
        Download your personal copy. Sharing and redistribution require the
        creator’s permission.
      </p>
      {ids.map((id, i) => (
        <button
          key={id}
          className="btn btn-outline mr-2"
          disabled={!!busy}
          onClick={async () => {
            setBusy(id);
            try {
              const url = await getProgramDownload({
                data: { editionId, assetId: id },
              });
              window.location.assign(url);
            } catch (e) {
              failure(e);
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === id ? "Preparing…" : `Download guide ${i + 1}`}
        </button>
      ))}
    </section>
  ) : null;
}
export function ProgramAssetAdmin() {
  const [items, setItems] = useState<Tables<"program_assets">[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    void supabase
      .from("program_assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then((r) => {
        if (r.error) setError("Private asset report unavailable");
        else {
          setItems(r.data);
          setError("");
        }
      });
  useEffect(load, []);
  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
      load();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card space-y-3 p-4">
      <h3 className="font-bold">Private PDF review · latest 100 files</h3>
      <p className="text-sm">
        Approval requires verified private storage and the documented
        malware/security review process. Static signature checks alone do not
        establish file safety. Independently inspect each file. Revocation stops
        new delivery and unpublishes affected listings; it cannot recall
        existing downloads.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="btn btn-outline" onClick={load}>
        Refresh files
      </button>
      {items.map((a) => (
        <div key={a.id} className="border-t pt-3">
          <p>
            {a.title} · {a.review_status} · Trainer {a.trainer_id}
          </p>
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const url = await previewProgramAsset({ data: { id: a.id } });
                window.open(url, "_blank", "noopener,noreferrer");
              })
            }
          >
            Review private PDF
          </button>
          {(["approved", "rejected"] as const).map((status) => (
            <button
              key={status}
              className="btn btn-outline mr-2"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  reviewProgramAsset({ data: { id: a.id, status } }),
                )
              }
            >
              {status === "approved"
                ? "Approve reviewed file"
                : "Reject / revoke file"}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
