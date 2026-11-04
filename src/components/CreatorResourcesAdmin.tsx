import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
export function CreatorResourcesAdmin() {
  const [kind, setKind] = useState<"school" | "perks">("school"),
    [tutorials, setTutorials] = useState<Tables<"school_tutorials">[]>([]),
    [perks, setPerks] = useState<Tables<"creator_perks">[]>([]),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async () => {
    const [t, p] = await Promise.all([
      supabase.from("school_tutorials").select("*").order("title"),
      supabase.from("creator_perks").select("*").order("partner"),
    ]);
    setTutorials(t.data ?? []);
    setPerks(p.data ?? []);
    setError(t.error || p.error ? "Could not load creator resources" : "");
  };
  useEffect(() => {
    void load();
  }, []);
  const tutorial = tutorials.find((t) => t.id === selected),
    perk = perks.find((t) => t.id === selected);
  return (
    <section className="card space-y-4 p-6">
      <h2 className="text-2xl font-bold">
        Creator Perks & Tryumph School administration
      </h2>
      <p>
        Only administrators can save these resources. Verify partner terms and
        tutorial accuracy before publishing. Unfinished tutorials stay drafts.
      </p>
      <label>
        Resource type
        <select
          className="field"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as "school" | "perks");
            setSelected("");
          }}
        >
          <option value="school">Tryumph School</option>
          <option value="perks">Creator Perks</option>
        </select>
      </label>
      <label>
        Edit resource
        <select
          className="field"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Create new</option>
          {kind === "school"
            ? tutorials.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.published ? "Published" : "Draft"} · {t.title}
                </option>
              ))
            : perks.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.published ? "Published" : "Disabled"} · {p.partner}
                </option>
              ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <form
        key={`${kind}:${selected}`}
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            v = (k: string) => String(f.get(k) ?? "");
          setBusy(true);
          try {
            if (kind === "school") {
              const screenshots = v("screenshots")
                .split("\n")
                .filter(Boolean)
                .map((line) => {
                  const [url, ...alt] = line.split(" | ");
                  return { url: url!.trim(), alt: alt.join(" | ").trim() };
                });
              const row = {
                audience: v("audience"),
                category: v("category"),
                title: v("title"),
                instructions: v("instructions"),
                screenshots: screenshots as Json,
                video_id: v("video_id") || null,
                published: f.has("published"),
              };
              const r = selected
                ? await supabase
                    .from("school_tutorials")
                    .update(row)
                    .eq("id", selected)
                : await supabase.from("school_tutorials").insert(row);
              if (r.error) throw r.error;
            } else {
              const row = {
                category: v("category"),
                partner: v("partner"),
                description: v("description"),
                eligibility: v("eligibility"),
                benefit: v("benefit"),
                redemption: v("redemption"),
                url: v("url") || null,
                disclosure: v("disclosure"),
                credential_pattern: v("credential_pattern"),
                expires_at: v("expires_at")
                  ? new Date(v("expires_at")).toISOString()
                  : null,
                published: f.has("published"),
              };
              const r = selected
                ? await supabase
                    .from("creator_perks")
                    .update(row)
                    .eq("id", selected)
                : await supabase.from("creator_perks").insert(row);
              if (r.error) throw r.error;
            }
            await load();
            toast.success("Resource saved");
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Resource could not be saved",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy} className="grid gap-3">
          {kind === "school" ? (
            <>
              <label>
                Audience
                <select
                  name="audience"
                  className="field"
                  defaultValue={tutorial?.audience ?? "creator"}
                >
                  <option value="creator">Creator Academy</option>
                  <option value="member">Member Help</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label>
                Category
                <input
                  name="category"
                  className="field"
                  required
                  maxLength={80}
                  defaultValue={tutorial?.category ?? "Creator Academy"}
                />
              </label>
              <label>
                Title
                <input
                  name="title"
                  className="field"
                  required
                  maxLength={160}
                  defaultValue={tutorial?.title}
                />
              </label>
              <label>
                Written instructions
                <textarea
                  name="instructions"
                  className="field min-h-40"
                  maxLength={20000}
                  defaultValue={tutorial?.instructions}
                />
              </label>
              <label>
                Screenshots — one HTTPS URL | accessible description per line
                <textarea
                  name="screenshots"
                  className="field"
                  defaultValue={(
                    tutorial?.screenshots as
                      { url: string; alt: string }[] | undefined
                  )
                    ?.map((i) => `${i.url} | ${i.alt}`)
                    .join("\n")}
                />
              </label>
              <label>
                Optional approved public video ID
                <input
                  name="video_id"
                  className="field"
                  defaultValue={tutorial?.video_id ?? ""}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Category
                <select
                  name="category"
                  className="field"
                  defaultValue={perk?.category ?? "education"}
                >
                  {["education", "equipment", "business", "growth"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {(
                [
                  "partner",
                  "description",
                  "eligibility",
                  "benefit",
                  "redemption",
                  "disclosure",
                  "credential_pattern",
                ] as const
              ).map((key) => (
                <label key={key}>
                  {key.replaceAll("_", " ")}
                  <textarea
                    name={key}
                    className="field"
                    required={key !== "credential_pattern"}
                    defaultValue={perk?.[key] ?? ""}
                  />
                </label>
              ))}
              <label>
                Redemption URL (optional)
                <input
                  type="url"
                  name="url"
                  className="field"
                  defaultValue={perk?.url ?? ""}
                />
              </label>
              <label>
                Expiration (optional)
                <input
                  type="datetime-local"
                  name="expires_at"
                  className="field"
                  defaultValue={perk?.expires_at?.slice(0, 16)}
                />
              </label>
            </>
          )}
          <label className="flex gap-2">
            <input
              type="checkbox"
              name="published"
              defaultChecked={
                kind === "school" ? tutorial?.published : perk?.published
              }
            />
            Publish verified, complete content
          </label>
          <button className="btn btn-primary">Save resource</button>
        </fieldset>
      </form>
    </section>
  );
}
export function CreatorPriceBounds() {
  const [limits, setLimits] = useState({
      minimum: 50,
      maximum: 1000000,
      recommended: 2999,
    }),
    [error, setError] = useState("");
  useEffect(() => {
    void supabase.rpc("creator_price_limits").then((r) => {
      if (r.error) setError("Price bounds unavailable");
      else setLimits(r.data as unknown as typeof limits);
    });
  }, []);
  return (
    <form
      className="card p-5 space-y-3"
      key={JSON.stringify(limits)}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const r = await supabase.rpc("configure_creator_prices", {
          p_min: Math.round(Number(f.get("minimum")) * 100),
          p_max: Math.round(Number(f.get("maximum")) * 100),
          p_recommended: Math.round(Number(f.get("recommended")) * 100),
        });
        if (r.error) setError(r.error.message);
        else {
          setError("");
          toast.success(
            "Monthly offer bounds saved. Existing subscription prices are preserved.",
          );
        }
      }}
    >
      <h2 className="text-xl font-bold">Monthly offer price bounds</h2>
      {error && <p role="alert">{error}</p>}
      {(["minimum", "maximum", "recommended"] as const).map((key) => (
        <label key={key} className="block">
          {key} (USD)
          <input
            className="field"
            name={key}
            type="number"
            min="0.50"
            max="10000"
            step="0.01"
            defaultValue={limits[key] / 100}
            required
          />
        </label>
      ))}
      <button className="btn btn-outline">Save bounds</button>
    </form>
  );
}
