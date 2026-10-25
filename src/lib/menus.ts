import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MealPlan } from "@/lib/store";

export type Target = { kcal: number; protein: number };
export type CloudMenu = { plan: MealPlan; target: Target; approved_by: string | null; approved_at: string | null };
export type Share = { client_id: string; nutritionist_id: string; client_name: string; nutritionist_name: string };

export const shareCode = (userId: string) => userId.slice(0, 8).toUpperCase();

/** Loads one person's weekly menu from the cloud and saves edits (debounced). */
export function useCloudMenu(userId: string | null) {
  const [menu, setMenu] = useState<CloudMenu | null>(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<CloudMenu>>({});

  const load = useCallback(async () => {
    if (!userId) { setMenu(null); setLoaded(false); return; }
    const { data } = await supabase.from("meal_plans").select("plan,target,approved_by,approved_at").eq("user_id", userId).maybeSingle();
    setMenu(data ? { plan: (data.plan ?? {}) as MealPlan, target: (data.target ?? { kcal: 2000, protein: 110 }) as Target, approved_by: data.approved_by, approved_at: data.approved_at } : null);
    setLoaded(true);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback((patch: Partial<CloudMenu>) => {
    if (!userId) return;
    setMenu((m) => ({ plan: {}, target: { kcal: 2000, protein: 110 }, approved_by: null, approved_at: null, ...m, ...patch }));
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const body = pending.current; pending.current = {};
      void supabase.from("meal_plans").upsert({ user_id: userId, ...body, updated_at: new Date().toISOString() } as never);
    }, 600);
  }, [userId]);

  return { menu, loaded, save, reload: load };
}

export function useShares(me: string | null) {
  const [shares, setShares] = useState<Share[]>([]);
  const reload = useCallback(async () => {
    if (!me) { setShares([]); return; }
    const { data } = await supabase.from("menu_shares").select("client_id,nutritionist_id,client_name,nutritionist_name").order("created_at");
    setShares(data ?? []);
  }, [me]);
  useEffect(() => { void reload(); }, [reload]);
  return { shares, reload };
}
