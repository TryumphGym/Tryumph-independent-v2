import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import { DISCOVERY } from "@/lib/discovery";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
export function TryumphSpotlight() {
  const me = useUserId(),
    [packages, setPackages] = useState<Tables<"spotlight_packages">[]>([]),
    [campaigns, setCampaigns] = useState<Tables<"spotlight_campaigns">[]>([]),
    [error, setError] = useState(""),
    [tags, setTags] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [targets, setTargets] = useState<
      { id: string; type: string; title: string }[]
    >([]);
  const load = async () => {
    if (!me) return;
    const [p, c, programs, lives] = await Promise.all([
      supabase.from("spotlight_packages").select("*").order("days"),
      supabase
        .from("spotlight_campaigns")
        .select("*")
        .eq("trainer_id", me)
        .order("created_at", { ascending: false }),
      supabase
        .from("trainer_programs")
        .select("id,title")
        .eq("trainer_id", me)
        .eq("published", true)
        .eq("blocked", false),
      supabase
        .from("live_sessions")
        .select("id,title")
        .eq("trainer_id", me)
        .eq("status", "scheduled")
        .eq("session_type", "scheduled")
        .gt("starts_at", new Date().toISOString()),
    ]);
    setError(p.error || c.error ? "Spotlight planning unavailable" : "");
    setTargets([
      { id: me, type: "profile", title: "My trainer profile" },
      ...(programs.data ?? []).map((p) => ({ ...p, type: "program" })),
      ...(lives.data ?? []).map((p) => ({ ...p, type: "live" })),
    ]);
    setPackages(p.data ?? []);
    setCampaigns(c.data ?? []);
  };
  useEffect(() => {
    void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);
  const current = campaigns.find((c) => c.id === selected);
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold">Tryumph Spotlight</h2>
      <p className="card p-5" role="status">
        Campaign planning only. Paid campaigns and placement are unavailable
        until inventory, billing, refunds, reporting and fulfillment pass
        staging acceptance. Drafts do not purchase placement or reserve
        inventory.
      </p>
      <p>
        Future placements will be clearly labeled Sponsored and relevant to
        members’ chosen categories and interests. Organic discovery remains
        available. There are no guaranteed views, followers or sales. Existing
        community ad-frequency and workout water-break rules remain unchanged.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-3">
        {packages.map((p) => (
          <div key={p.id} className="card p-4">
            {p.days} days · ${(p.price_cents / 100).toFixed(2)}
            <p className="text-xs">Configurable test price · not for sale</p>
          </div>
        ))}
      </div>
      <label>
        Campaign draft
        <select
          className="field"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setTags(campaigns.find((c) => c.id === e.target.value)?.tags ?? []);
          }}
        >
          <option value="">New draft</option>
          {campaigns
            .filter((c) => c.status === "draft")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {targets.find((t) => t.id === c.target_id)?.title ??
                  "Unavailable content"}{" "}
                · draft
              </option>
            ))}
        </select>
      </label>
      <form
        key={selected}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!me) return;
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            const [type, target] = String(f.get("target")).split(":");
            const r = await supabase.rpc("save_spotlight_draft", {
              p_type: type!,
              p_target: target!,
              p_package: String(f.get("package")),
              p_budget: Math.round(Number(f.get("budget")) * 100),
              p_tags: tags,
              ...(selected ? { p_id: selected } : {}),
              p_cancel: f.has("cancel"),
            });
            if (r.error) throw r.error;
            await load();
            setSelected("");
            setTags([]);
            toast.success(
              "Campaign draft saved. No payment or placement was created.",
            );
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Unable to save draft",
            );
          } finally {
            setBusy(false);
          }
        }}
        className="card p-5 space-y-3"
      >
        <fieldset disabled={busy} className="grid gap-3">
          <label>
            Promote
            <select
              name="target"
              className="field"
              defaultValue={
                current
                  ? `${current.target_type}:${current.target_id}`
                  : `profile:${me}`
              }
              required
            >
              {targets.map((t) => (
                <option key={t.id} value={`${t.type}:${t.id}`}>
                  {t.type} · {t.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Test package
            <select
              name="package"
              className="field"
              defaultValue={current?.package_id}
              required
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.days} days — ${(p.price_cents / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Maximum draft budget (USD)
            <input
              name="budget"
              className="field"
              type="number"
              min="0.50"
              step="0.01"
              max="10000"
              defaultValue={(current?.budget_cents ?? 500) / 100}
              required
            />
          </label>
          <fieldset>
            <legend>Fitness-goal context</legend>
            {DISCOVERY.goal.map(([id, label]) => (
              <label className="flex gap-2" key={id}>
                <input
                  type="checkbox"
                  checked={tags.includes(id)}
                  onChange={(e) =>
                    setTags((v) =>
                      e.target.checked ? [...v, id] : v.filter((x) => x !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
            <p className="text-xs">
              General fitness context only; no member diagnoses or sensitive
              health audiences.
            </p>
          </fieldset>
          {current && (
            <label>
              <input type="checkbox" name="cancel" />
              Cancel draft
            </label>
          )}
          <button className="btn btn-primary">Save draft — no charge</button>
        </fieldset>
      </form>
      <h3 className="text-xl font-bold">Campaign performance</h3>
      <p>
        No placements have been fulfilled. No campaign impressions, clicks or
        conversions are reported.
      </p>
    </section>
  );
}
export function SpotlightAdmin() {
  const [items, setItems] = useState<Tables<"spotlight_packages">[]>([]),
    [campaigns, setCampaigns] = useState<Tables<"spotlight_campaigns">[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from("spotlight_packages").select("*").order("days"),
      supabase
        .from("spotlight_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setItems(p.data ?? []);
    setCampaigns(c.data ?? []);
    setError(p.error || c.error ? "Spotlight administration unavailable" : "");
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-2xl font-bold">Spotlight test pricing & inventory</h2>
      <p>
        Planning configuration only. Availability does not activate checkout or
        fulfillment. Campaigns cannot enter a paid or active state in this
        release.
      </p>
      {error && <p role="alert">{error}</p>}
      {items.map((p) => (
        <form
          key={`${p.id}:${p.updated_at}`}
          className="flex flex-wrap gap-3 rounded border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const r = await supabase
                .from("spotlight_packages")
                .update({
                  price_cents: Math.round(Number(f.get("price")) * 100),
                  inventory: Number(f.get("inventory")),
                  available: f.has("available"),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", p.id);
              if (r.error) throw r.error;
              await load();
              toast.success(
                "Test configuration saved; paid campaigns remain disabled",
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Save failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <strong>{p.days} days</strong>
          <label>
            Test price (USD)
            <input
              className="field"
              name="price"
              type="number"
              min="0.5"
              step="0.01"
              defaultValue={p.price_cents / 100}
            />
          </label>
          <label>
            Planned slots
            <input
              className="field"
              name="inventory"
              type="number"
              min="0"
              step="1"
              defaultValue={p.inventory}
            />
          </label>
          <label>
            <input
              name="available"
              type="checkbox"
              defaultChecked={p.available}
            />
            Planned availability
          </label>
          <button className="btn btn-outline" disabled={busy}>
            Save test package
          </button>
        </form>
      ))}
      <h3 className="text-xl font-bold">Eligibility review</h3>
      {campaigns.map((c) => (
        <form
          key={`${c.id}:${c.updated_at}`}
          className="rounded border p-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              const r = await supabase
                .from("spotlight_campaigns")
                .update({
                  admin_eligible: f.has("eligible"),
                  admin_note: String(f.get("note") ?? ""),
                  updated_at: new Date().toISOString(),
                })
                .eq("id", c.id);
              if (r.error) throw r.error;
              await load();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Review failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {c.target_type} · {c.status} · budget $
            {(c.budget_cents / 100).toFixed(2)}
          </p>
          <label>
            <input
              name="eligible"
              type="checkbox"
              defaultChecked={c.admin_eligible}
            />
            Eligible when fulfillment is available
          </label>
          <label>
            Review note
            <input
              className="field"
              name="note"
              maxLength={1000}
              defaultValue={c.admin_note}
            />
          </label>
          <button className="btn btn-outline" disabled={busy}>
            Save eligibility
          </button>
        </form>
      ))}
    </section>
  );
}
