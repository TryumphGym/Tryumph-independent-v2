import { trackDiscoveryDemand } from "@/lib/demand";
import { DiscoveryFilters } from "./DiscoveryFilters";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import type { ProgramSummary } from "@/lib/programs";
import type { Tables } from "@/integrations/supabase/types";
export function ProgramCatalog({ trainerId }: { trainerId?: string }) {
  const me = useUserId();
  const [focus, setFocus] = useState<string[]>([]);
  const [libraryPage, setLibraryPage] = useState(0),
    [libraryNext, setLibraryNext] = useState(false);
  const [items, setItems] = useState<Tables<"trainer_programs">[]>([]),
    [mine, setMine] = useState<Tables<"trainer_programs">[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [search, setSearch] = useState(""),
    [mode, setMode] = useState("all"),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(0),
    [hasNext, setHasNext] = useState(false),
    [queryText, setQueryText] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQueryText(search.replace(/[%_]/g, "").trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void (async () => {
      let query = supabase
        .from("discoverable_programs")
        .select("*")
        .eq("builder_version", 2)
        .eq("published", true)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(page * 12, page * 12 + 12);
      if (focus.length) query = query.contains("discovery_focus_tags", focus);
      if (queryText) query = query.ilike("title", `%${queryText}%`);
      if (mode !== "all") query = query.eq("summary->>mode", mode);
      if (category !== "all") query = query.eq("summary->>category", category);
      if (trainerId) query = query.eq("trainer_id", trainerId);
      const result = await query;
      if (!active) return;
      if (result.error) {
        setError(true);
        setItems([]);
      } else {
        if (me && !trainerId)
          trackDiscoveryDemand({
            source: "programs",
            query: queryText,
            tags: focus,
            category: category === "all" ? "" : category,
          });
        setItems(result.data.slice(0, 12) as Tables<"trainer_programs">[]);
        setHasNext(result.data.length > 12);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [trainerId, me, page, mode, category, queryText, focus]);
  useEffect(() => {
    let active = true;
    setMine([]);
    void (async () => {
      if (me && !trainerId) {
        const n = await supabase
          .from("program_member_enrollments")
          .select("program_id")
          .eq("user_id", me)
          .order("created_at", { ascending: false })
          .range(libraryPage * 20, libraryPage * 20 + 20);
        if (n.error) return;
        if (active) setLibraryNext(n.data.length > 20);
        const p = await supabase
          .from("trainer_programs")
          .select("*")
          .in("id", [
            ...new Set(
              n.data
                .slice(0, 20)
                .map((x) => x.program_id)
                .filter((id): id is string => !!id),
            ),
          ]);
        if (active && !p.error) setMine(p.data);
      } else setMine([]);
    })();
    return () => {
      active = false;
    };
  }, [me, trainerId, libraryPage]);
  const card = (p: Tables<"trainer_programs">) => {
    const s = p.summary as unknown as ProgramSummary;
    return (
      <article key={p.id} className="card overflow-hidden">
        <Link to="/programs/$id" params={{ id: p.id }} className="block p-5">
          {s.cover_url && (
            <img
              src={s.cover_url}
              alt=""
              referrerPolicy="no-referrer"
              className="mb-3 aspect-video w-full rounded object-cover"
              loading="lazy"
            />
          )}
          <h3 className="text-lg font-bold">{p.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
            {p.description}
          </p>
          <p className="mt-3 text-sm">
            {s.duration_weeks} weeks · {s.difficulty} ·{" "}
            {s.mode === "free"
              ? "Free enrollment"
              : s.mode === "members"
                ? "Members Only"
                : s.mode === "external"
                  ? "External seller"
                  : `$${(s.price_cents / 100).toFixed(2)}`}
          </p>
          <p className="text-xs">
            {s.access_period === "lifetime"
              ? "Lifetime access"
              : `${s.access_period} days from confirmation`}
          </p>
          <p className="mt-2 text-primary">View program →</p>
        </Link>
      </article>
    );
  };
  return (
    <section className="space-y-4" aria-label="Workout programs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">Structured workout programs</h2>
        <Link to="/studio" className="text-primary underline">
          Trainer program studio
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Build a routine over several weeks. Free on-demand workouts remain
        available without a recurring membership.
      </p>
      {!trainerId && mine.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-bold">My programs · resume</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map(card)}
          </div>
          <nav
            aria-label="My program library pages"
            className="mt-3 flex gap-3"
          >
            <button
              className="btn btn-outline"
              disabled={!libraryPage}
              onClick={() => setLibraryPage((n) => n - 1)}
            >
              Previous in library
            </button>
            <span>Library page {libraryPage + 1}</span>
            <button
              className="btn btn-outline"
              disabled={!libraryNext}
              onClick={() => setLibraryPage((n) => n + 1)}
            >
              More in library
            </button>
          </nav>
        </section>
      )}
      <DiscoveryFilters
        value={focus}
        onChange={(v) => {
          setFocus(v);
          setPage(0);
        }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          Search programs
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Program title"
          />
        </label>
        <label>
          Access
          <select
            className="field"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All programs</option>
            <option value="free">Free</option>
            <option value="members">Members Only</option>
            <option value="native">Native purchase</option>
            <option value="external">External seller</option>
          </select>
        </label>
        <label>
          Category
          <select
            className="field"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All categories</option>
            {[
              "Strength",
              "Cardio",
              "Mobility",
              "Yoga",
              "Pilates",
              "Recovery",
              "General Fitness",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p role="status">Loading programs…</p>
      ) : error ? (
        <p role="alert">
          Programs are unavailable right now. Please try again later.
        </p>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(card)}
        </div>
      ) : (
        <p className="card p-6">
          No published programs match these filters yet.
        </p>
      )}
      <nav
        aria-label="Program catalog pages"
        className="flex items-center gap-3"
      >
        <button
          className="btn btn-outline"
          disabled={page === 0 || loading}
          onClick={() => setPage((n) => n - 1)}
        >
          Previous page
        </button>
        <span>Page {page + 1}</span>
        <button
          className="btn btn-outline"
          disabled={!hasNext || loading}
          onClick={() => setPage((n) => n + 1)}
        >
          Next page
        </button>
      </nav>
    </section>
  );
}
