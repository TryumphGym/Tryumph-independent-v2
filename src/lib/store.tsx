import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedPosts, TOKEN_PRICE } from "./data";

export type Post = { id: string; author: string; trybe: string; text: string; kind: string; likes: number; comments: string[]; liked?: boolean };
export type LedgerEntry = { id: string; label: string; tokens: number; date: string };
export type Booking = { id: string; trainerId: string; date: string; time: string; price: number };
export type Review = { id: string; trainerId: string; author: string; text: string; stars: number; reply?: string | undefined };
export type PlanMeal = { id: string; title: string; kcal: number; protein: number; carbs: number; fat: number; ingredients?: string[] | undefined; note?: string | undefined; by?: string | undefined };
export type MealPlan = Record<string, Record<string, PlanMeal[]>>;
export type Cert = { id: string; name: string; credentialId: string; expires: string; status: "Pending review" | "Verified" };
export type TrainerVideo = { id: string; title: string; category: string; level: string; minutes: number; path?: string; equipment?: string; pregnancySafe?: boolean; playlist?: string; goals?: string[] };
export type StoreItem = { id: string; name: string; price: number; url?: string };
export type CalBlock = { id: string; date: string; label: string; kind: "personal" | "live" | "oneonone"; time?: string | undefined };
export type Alert = { id: string; text: string; date: string };
export type Extra = {
  onboarded: boolean;
  conditions: string[]; goals: string[]; why: string; gear?: string[]; styles?: string[]; quiet?: boolean;
  mealPlan: MealPlan; macroTarget: { kcal: number; protein: number };
  friends: string[]; chats: Record<string, { from: string; text: string }[]>;
  joinedTrybes: string[]; alerts: Alert[];
  pregnant?: boolean; dueDate?: string; followed?: string[];
  trainer: { kind: "Trainer" | "Nutritionist" | "Both"; certs: Cert[]; specialties: string[]; rate: number; bio: string; videos: TrainerVideo[]; store: StoreItem[]; blocks: CalBlock[]; agreed: boolean; pinned: string[]; removed: string[] };
};
export const emptyExtra: Extra = {
  onboarded: false, conditions: [], goals: [], why: "",
  mealPlan: {}, macroTarget: { kcal: 2000, protein: 110 },
  friends: [], chats: {}, joinedTrybes: [], alerts: [],
  trainer: { kind: "Trainer", certs: [], specialties: [], rate: 60, bio: "", videos: [], store: [], blocks: [], agreed: false, pinned: [], removed: [] },
};

export type State = {
  signedIn: boolean;
  name: string;
  role: "member" | "trainer";
  tokens: number;
  reservations: string[];
  joined: string[];
  watchLater: string[];
  history: string[];
  activeDays: string[];
  posts: Post[];
  partners: string[];
  ledger: LedgerEntry[];
  bookings: Booking[];
  reviews: Review[];
  weighIns: { date: string; weight: number }[];
  profile: { height: number; weight: number; goal: string; level: string; prefs: string; postpartum: boolean; drGap: string; weeksPostpartum: string; avatar: string };
  scheduled: { id: string; title: string; category: string; level: string; when: string; description: string }[];
  extra: Extra;
};

const initial: State = {
  signedIn: false, name: "Guest", role: "member", tokens: 0,
  reservations: [], joined: [], watchLater: [], history: [], activeDays: [],
  posts: seedPosts, partners: [], ledger: [], bookings: [],
  reviews: [
    { id: "r1", trainerId: "maya", author: "Jess R.", text: "Patient, kind and knows postpartum bodies.", stars: 5 },
    { id: "r2", trainerId: "dre", author: "Leo M.", text: "Tough but encouraging. Great cues.", stars: 5 },
  ],
  weighIns: [],
  profile: { height: 165, weight: 70, goal: "Build strength", level: "Beginner", prefs: "", postpartum: false, drGap: "", weeksPostpartum: "", avatar: "" },
  scheduled: [],
  extra: emptyExtra,
};

const KEY = "tryumph-state-v1";
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

type Ctx = {
  s: State;
  set: (fn: (s: State) => State) => void;
  signIn: (name: string, role: State["role"]) => void;
  signOut: () => void;
  buyTokens: (n: number) => void;
  reserve: (id: string) => void;
  joinRoom: (id: string, title: string) => { ok: boolean; msg: string };
  markActive: () => void;
  watch: (videoId: string) => void;
  toggleWatchLater: (videoId: string) => void;
  book: (b: Omit<Booking, "id">) => { ok: boolean; msg: string };
  uid: () => string;
  setExtra: (fn: (e: Extra) => Extra) => void;
};
// Keep one context instance across hot reloads so the provider and consumers always match.
const g = globalThis as unknown as { __tryumphStoreCtx?: React.Context<Ctx | null> };
const StoreCtx = g.__tryumphStoreCtx ?? (g.__tryumphStoreCtx = createContext<Ctx | null>(null));

type ProfileRow = {
  id: string; name: string; role: string; tokens: number;
  height: number | null; weight: number | null; goal: string | null; level: string | null; prefs: string | null;
  postpartum: boolean; dr_gap: string | null; weeks_postpartum: string | null; avatar_url: string | null;
  active_days: unknown; reservations: unknown; joined: unknown; watch_later: unknown; history: unknown;
  partners: unknown; ledger: unknown; bookings: unknown; weigh_ins: unknown; scheduled: unknown; extra?: unknown;
};

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function mergeExtra(v: unknown): Extra {
  const e = (v && typeof v === "object" ? v : {}) as Partial<Extra>;
  return { ...emptyExtra, ...e, trainer: { ...emptyExtra.trainer, ...(e.trainer ?? {}) } };
}

function rowToState(row: ProfileRow): State {
  return {
    ...initial,
    signedIn: true,
    name: row.name || "Member",
    role: row.role === "trainer" ? "trainer" : "member",
    tokens: row.tokens ?? 0,
    reservations: arr(row.reservations), joined: arr(row.joined), watchLater: arr(row.watch_later),
    history: arr(row.history), activeDays: arr(row.active_days), partners: arr(row.partners),
    ledger: arr(row.ledger), bookings: arr(row.bookings), weighIns: arr(row.weigh_ins), scheduled: arr(row.scheduled),
    extra: mergeExtra(row.extra),
    profile: {
      height: row.height ?? 0, weight: row.weight ?? 0,
      goal: row.goal ?? "Build strength", level: row.level ?? "Beginner", prefs: row.prefs ?? "",
      postpartum: row.postpartum ?? false, drGap: row.dr_gap ?? "", weeksPostpartum: row.weeks_postpartum ?? "", avatar: row.avatar_url ?? "",
    },
  };
}

function stateToRow(userId: string, s: State) {
  return {
    id: userId, name: s.name, role: s.role, tokens: s.tokens,
    height: s.profile.height || null, weight: s.profile.weight || null,
    goal: s.profile.goal, level: s.profile.level, prefs: s.profile.prefs,
    postpartum: s.profile.postpartum, dr_gap: s.profile.drGap, weeks_postpartum: s.profile.weeksPostpartum, avatar_url: s.profile.avatar || null,
    active_days: s.activeDays, reservations: s.reservations, joined: s.joined,
    watch_later: s.watchLater, history: s.history, partners: s.partners,
    ledger: s.ledger, bookings: s.bookings, weigh_ins: s.weighIns, scheduled: s.scheduled,
    extra: s.extra as unknown as never,
    updated_at: new Date().toISOString(),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const [loaded, setLoaded] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(false);

  // Load guest state from device, then attach to the cloud session if one exists.
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const g = JSON.parse(raw); setS(g.signedIn ? { ...initial, ...g, extra: mergeExtra(g.extra) } : { ...initial, extra: emptyExtra }); } } catch {}
    setLoaded(true);

    const loadProfile = async (userId: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) {
        skipSave.current = true;
        userIdRef.current = userId;
        setS(rowToState(data as ProfileRow));
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      const uidNow = data.session?.user.id;
      if (uidNow) loadProfile(uidNow);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") loadProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        skipSave.current = true;
        setS({ ...initial, posts: seedPosts, reviews: initial.reviews, extra: emptyExtra });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Persist: localStorage for guests, cloud profile for signed-in users (debounced).
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    if (userIdRef.current && s.signedIn) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const snapshot = s;
      saveTimer.current = setTimeout(() => {
        supabase.from("profiles").upsert(stateToRow(userIdRef.current!, snapshot)).then(() => {});
      }, 600);
    } else {
      localStorage.setItem(KEY, JSON.stringify(s));
    }
  }, [s, loaded]);

  const set = (fn: (s: State) => State) => setS(fn);
  const markActive = () => set((x) => (x.activeDays.includes(today()) ? x : { ...x, activeDays: [...x.activeDays, today()] }));

  const ctx: Ctx = {
    s, set, uid, markActive,
    signIn: (name, role) => set((x) => ({ ...x, signedIn: true, name, role })),
    signOut: () => { void supabase.auth.signOut(); },
    buyTokens: (n) => set((x) => ({ ...x, tokens: x.tokens + n, ledger: [{ id: uid(), label: `Bought ${n} tokens ($${n * TOKEN_PRICE})`, tokens: n, date: today() }, ...x.ledger] })),
    reserve: (id) => set((x) => ({ ...x, reservations: x.reservations.includes(id) ? x.reservations.filter((r) => r !== id) : [...x.reservations, id] })),
    setExtra: (fn) => set((x) => ({ ...x, extra: fn(x.extra) })),
    joinRoom: (id, title) => {
      if (!s.signedIn) return { ok: false, msg: "Sign in to join live rooms." };
      if (s.joined.includes(id)) return { ok: true, msg: "Rejoining — already paid." };
      if (s.tokens < 1) return { ok: false, msg: "You need 1 token. Top up in your Wallet." };
      set((x) => ({ ...x, tokens: x.tokens - 1, joined: [...x.joined, id], ledger: [{ id: uid(), label: `Joined: ${title}`, tokens: -1, date: today() }, ...x.ledger], activeDays: x.activeDays.includes(today()) ? x.activeDays : [...x.activeDays, today()] }));
      return { ok: true, msg: "1 token used. Welcome in!" };
    },
    watch: (videoId) => set((x) => ({ ...x, history: [videoId, ...x.history.filter((h) => h !== videoId)].slice(0, 20), activeDays: x.activeDays.includes(today()) ? x.activeDays : [...x.activeDays, today()] })),
    toggleWatchLater: (v) => set((x) => ({ ...x, watchLater: x.watchLater.includes(v) ? x.watchLater.filter((w) => w !== v) : [...x.watchLater, v] })),
    book: (b) => {
      if (!s.signedIn) return { ok: false, msg: "Sign in to book a session." };
      set((x) => ({ ...x, bookings: [...x.bookings, { ...b, id: uid() }] }));
      return { ok: true, msg: `Session booked — $${b.price} paid by card (test mode). You'll get a private room link.` };
    },
  };
  return <StoreCtx.Provider value={ctx}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

export function streak(days: string[]) {
  const set = new Set(days);
  let n = 0; const d = new Date();
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const HARSH = ["stupid", "idiot", "hate", "terrible", "worst", "ugly", "fat", "lazy", "scam", "trash", "sucks", "useless"];
export function reviewCheck(text: string): { ok: boolean; note: string } {
  const t = text.toLowerCase();
  if (t.trim().length < 15) return { ok: false, note: "Add a bit more detail so others can learn from your experience." };
  const hit = HARSH.find((w) => t.includes(w));
  if (hit) return { ok: false, note: `Try rephrasing "${hit}" constructively — what could be improved?` };
  if (/(.)\1{4,}/.test(t) || /[A-Z]{8,}/.test(text)) return { ok: false, note: "Please avoid shouting or spam-like text." };
  return { ok: true, note: "Looks kind and constructive. Thanks!" };
}
