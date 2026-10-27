import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { seedPosts, TOKEN_PRICE } from "./data";

export type Post = {
  id: string;
  author: string;
  trybe: string;
  text: string;
  kind: string;
  likes: number;
  comments: string[];
  liked?: boolean;
};
export type LedgerEntry = {
  id: string;
  label: string;
  tokens: number;
  date: string;
};
export type Booking = {
  id: string;
  trainerId: string;
  date: string;
  time: string;
  price: number;
};
export type Review = {
  id: string;
  trainerId: string;
  author: string;
  text: string;
  stars: number;
  reply?: string | undefined;
};
export type PlanMeal = {
  id: string;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients?: string[] | undefined;
  note?: string | undefined;
  by?: string | undefined;
};
export type MealPlan = Record<string, Record<string, PlanMeal[]>>;
export type Cert = {
  id: string;
  name: string;
  credentialId: string;
  expires: string;
  status: "Pending review" | "Verified";
};
export type TrainerVideo = {
  reviewStatus?: string;
  reviewNote?: string;
  id: string;
  title: string;
  category: string;
  level: string;
  minutes: number;
  path?: string;
  equipment?: string;
  pregnancySafe?: boolean;
  playlist?: string;
  goals?: string[];
};
export type StoreItem = {
  id: string;
  name: string;
  price: number;
  url?: string;
  image?: string;
  description?: string;
};
export type CalBlock = {
  id: string;
  date: string;
  label: string;
  kind: "personal" | "live" | "oneonone";
  time?: string | undefined;
};
export type Alert = { id: string; text: string; date: string };
export type Extra = {
  onboarded: boolean;
  conditions: string[];
  goals: string[];
  why: string;
  gear?: string[];
  styles?: string[];
  quiet?: boolean;
  mealPlan: MealPlan;
  macroTarget: { kcal: number; protein: number };
  friends: string[];
  chats: Record<string, { from: string; text: string }[]>;
  joinedTrybes: string[];
  alerts: Alert[];
  pregnant?: boolean;
  dueDate?: string;
  followed?: string[];
  trainer: {
    kind: "Trainer" | "Nutritionist" | "Both";
    certs: Cert[];
    specialties: string[];
    rate: number;
    bio: string;
    website?: string;
    instagram?: string;
    videos: TrainerVideo[];
    store: StoreItem[];
    blocks: CalBlock[];
    agreed: boolean;
    pinned: string[];
    removed: string[];
  };
};
export const emptyExtra: Extra = {
  onboarded: false,
  conditions: [],
  goals: [],
  why: "",
  mealPlan: {},
  macroTarget: { kcal: 2000, protein: 110 },
  friends: [],
  chats: {},
  joinedTrybes: [],
  alerts: [],
  trainer: {
    kind: "Trainer",
    certs: [],
    specialties: [],
    rate: 60,
    bio: "",
    videos: [],
    store: [],
    blocks: [],
    agreed: false,
    pinned: [],
    removed: [],
  },
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
  profile: {
    height: number;
    weight: number;
    goal: string;
    level: string;
    prefs: string;
    postpartum: boolean;
    drGap: string;
    weeksPostpartum: string;
    avatar: string;
  };
  scheduled: {
    id: string;
    title: string;
    category: string;
    level: string;
    when: string;
    description: string;
  }[];
  extra: Extra;
};

const initial: State = {
  signedIn: false,
  name: "Guest",
  role: "member",
  tokens: 0,
  reservations: [],
  joined: [],
  watchLater: [],
  history: [],
  activeDays: [],
  posts: [],
  partners: [],
  ledger: [],
  bookings: [],
  reviews: [],
  weighIns: [],
  profile: {
    height: 165,
    weight: 70,
    goal: "Build strength",
    level: "Beginner",
    prefs: "",
    postpartum: false,
    drGap: "",
    weeksPostpartum: "",
    avatar: "",
  },
  scheduled: [],
  extra: emptyExtra,
};

const KEY = "tryumph-state-v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const uid = () => Math.random().toString(36).slice(2, 9);

type Ctx = {
  s: State;
  set: (fn: (s: State) => State) => void;
  saveProfile: (fn: (s: State) => State) => Promise<void>;
  signIn: (name: string, role: State["role"]) => void;
  signOut: () => void;
  reserve: (id: string) => void;
  markActive: () => void;
  watch: (videoId: string) => void;
  toggleWatchLater: (videoId: string) => void;
  uid: () => string;
  setExtra: (fn: (e: Extra) => Extra) => void;
};
// Keep one context instance across hot reloads so the provider and consumers always match.
const g = globalThis as unknown as {
  __tryumphStoreCtx?: React.Context<Ctx | null>;
};
const StoreCtx =
  g.__tryumphStoreCtx ??
  (g.__tryumphStoreCtx = createContext<Ctx | null>(null));

type ProfileRow = {
  id: string;
  name: string;
  role: string;
  tokens: number;
  height: number | null;
  weight: number | null;
  goal: string | null;
  level: string | null;
  prefs: string | null;
  postpartum: boolean;
  dr_gap: string | null;
  weeks_postpartum: string | null;
  avatar_url: string | null;
  active_days: unknown;
  reservations: unknown;
  joined: unknown;
  watch_later: unknown;
  history: unknown;
  partners: unknown;
  ledger: unknown;
  bookings: unknown;
  weigh_ins: unknown;
  scheduled: unknown;
  extra?: unknown;
};

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function mergeExtra(v: unknown): Extra {
  const e = (v && typeof v === "object" ? v : {}) as Partial<Extra>;
  return {
    ...emptyExtra,
    ...e,
    trainer: { ...emptyExtra.trainer, ...(e.trainer ?? {}) },
  };
}

function rowToState(row: ProfileRow): State {
  return {
    ...initial,
    signedIn: true,
    name: row.name || "Member",
    role: row.role === "trainer" ? "trainer" : "member",
    tokens: row.tokens ?? 0,
    reservations: arr(row.reservations),
    joined: arr(row.joined),
    watchLater: arr(row.watch_later),
    history: arr(row.history),
    activeDays: arr(row.active_days),
    partners: arr(row.partners),
    ledger: arr(row.ledger),
    bookings: arr(row.bookings),
    weighIns: arr(row.weigh_ins),
    scheduled: arr(row.scheduled),
    extra: mergeExtra(row.extra),
    profile: {
      height: row.height ?? 0,
      weight: row.weight ?? 0,
      goal: row.goal ?? "Build strength",
      level: row.level ?? "Beginner",
      prefs: row.prefs ?? "",
      postpartum: row.postpartum ?? false,
      drGap: row.dr_gap ?? "",
      weeksPostpartum: row.weeks_postpartum ?? "",
      avatar: row.avatar_url ?? "",
    },
  };
}

function stateToRow(userId: string, s: State) {
  return {
    id: userId,
    name: s.name,
    role: s.role,
    height: s.profile.height || null,
    weight: s.profile.weight || null,
    goal: s.profile.goal,
    level: s.profile.level,
    prefs: s.profile.prefs,
    postpartum: s.profile.postpartum,
    dr_gap: s.profile.drGap,
    weeks_postpartum: s.profile.weeksPostpartum,
    avatar_url: s.profile.avatar || null,
    active_days: s.activeDays,
    reservations: s.reservations,
    watch_later: s.watchLater,
    history: s.history,
    partners: s.partners,
    weigh_ins: s.weighIns,
    scheduled: s.scheduled,
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
  const stateRef = useRef(s);
  stateRef.current = s;
  const profileLoadVersion = useRef(0);

  // Load guest state from device, then attach to the cloud session if one exists.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const g = JSON.parse(raw);
        setS({ ...initial, extra: mergeExtra(g.extra) });
      }
    } catch {
      /* Ignore invalid local preference cache. */
    }
    setLoaded(true);

    const loadProfile = async (userId: string) => {
      const version = ++profileLoadVersion.current;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (version !== profileLoadVersion.current) return;
      if (error) {
        console.error("[Tryumph] Profile load failed:", error);
        return;
      }
      if (data) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
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
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
          loadProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        profileLoadVersion.current++;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        userIdRef.current = null;
        skipSave.current = true;
        setS({
          ...initial,
          posts: seedPosts,
          reviews: initial.reviews,
          extra: emptyExtra,
        });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Count one active day per signed-in local calendar day. Visit activity is
  // distinct from completed-workout activity; do not count guests.
  useEffect(() => {
    if (!loaded || !s.signedIn || !userIdRef.current) return;
    const day = today();
    if (s.activeDays.includes(day)) return;
    setS((prev) =>
      prev.signedIn && !prev.activeDays.includes(day)
        ? { ...prev, activeDays: [...prev.activeDays, day] }
        : prev,
    );
  }, [loaded, s.signedIn, s.activeDays]);

  // Persist: localStorage for guests, cloud profile for signed-in users (debounced).
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (userIdRef.current && s.signedIn) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const snapshot = s;
      const userId = userIdRef.current;
      saveTimer.current = setTimeout(() => {
        if (userIdRef.current !== userId) return;
        void supabase
          .from("profiles")
          .update(stateToRow(userId, snapshot))
          .eq("id", userId)
          .then(({ error }) => {
            if (error) {
              console.error("[Tryumph] Automatic profile save failed:", error);
              // Background saves must not falsely report success.
            }
          });
      }, 600);
    } else {
      localStorage.setItem(KEY, JSON.stringify(s));
    }
  }, [s, loaded]);

  useEffect(() => {
    const refresh = async () => {
      const id = userIdRef.current;
      if (!id) return;
      const result = await supabase
        .from("profiles")
        .select("tokens,ledger,bookings,joined")
        .eq("id", id)
        .single();
      if (result.error || id !== userIdRef.current) return;
      const row = result.data;
      setS((previous) =>
        JSON.stringify([
          previous.tokens,
          previous.ledger,
          previous.bookings,
          previous.joined,
        ]) ===
        JSON.stringify([row.tokens, row.ledger, row.bookings, row.joined])
          ? previous
          : {
              ...previous,
              tokens: row.tokens,
              ledger: arr(row.ledger),
              bookings: arr(row.bookings),
              joined: arr(row.joined),
            },
      );
    };
    const interval = setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const set = (fn: (s: State) => State) => setS(fn);
  const markActive = () =>
    set((x) =>
      x.activeDays.includes(today())
        ? x
        : { ...x, activeDays: [...x.activeDays, today()] },
    );

  const saveProfile = async (fn: (current: State) => State): Promise<void> => {
    const userId = userIdRef.current;
    if (!userId)
      throw new Error(
        "Your profile is still loading. Please try again in a moment.",
      );
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const next = fn(stateRef.current);
    // Do not show success or update the local state until Supabase confirms the write.
    const { data, error } = await supabase
      .from("profiles")
      .update(stateToRow(userId, next))
      .eq("id", userId)
      .select("id");
    if (error) {
      console.error("[Tryumph] Profile save failed:", error);
      throw new Error(error.message);
    }
    if (!data?.length)
      throw new Error(
        "Supabase did not update your profile. Please check your account permissions.",
      );
    if (userIdRef.current !== userId)
      throw new Error(
        "Your session changed while saving. Please sign in again.",
      );
    skipSave.current = true;
    setS(next);
  };

  const ctx: Ctx = {
    s,
    set,
    saveProfile,
    uid,
    markActive,
    signIn: (name, role) => set((x) => ({ ...x, signedIn: true, name, role })),
    signOut: () => {
      void supabase.auth.signOut();
    },
    reserve: (id) =>
      set((x) => ({
        ...x,
        reservations: x.reservations.includes(id)
          ? x.reservations.filter((r) => r !== id)
          : [...x.reservations, id],
      })),
    setExtra: (fn) => set((x) => ({ ...x, extra: fn(x.extra) })),
    watch: (videoId) =>
      set((x) => ({
        ...x,
        history: [videoId, ...x.history.filter((h) => h !== videoId)].slice(
          0,
          20,
        ),
        activeDays: x.activeDays.includes(today())
          ? x.activeDays
          : [...x.activeDays, today()],
      })),
    toggleWatchLater: (v) =>
      set((x) => ({
        ...x,
        watchLater: x.watchLater.includes(v)
          ? x.watchLater.filter((w) => w !== v)
          : [...x.watchLater, v],
      })),
  };
  return <StoreCtx.Provider value={ctx}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

export function streak(days: string[], now = new Date()) {
  // A daily streak stays visible until the end of the next local day.
  const recorded = new Set(days);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const localDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (!recorded.has(localDay(day))) day.setDate(day.getDate() - 1);
  let n = 0;
  while (recorded.has(localDay(day))) {
    n++;
    day.setDate(day.getDate() - 1);
  }
  return n;
}

const HARSH = [
  "stupid",
  "idiot",
  "hate",
  "terrible",
  "worst",
  "ugly",
  "fat",
  "lazy",
  "scam",
  "trash",
  "sucks",
  "useless",
];
export function reviewCheck(text: string): { ok: boolean; note: string } {
  const t = text.toLowerCase();
  if (t.trim().length < 15)
    return {
      ok: false,
      note: "Add a bit more detail so others can learn from your experience.",
    };
  const hit = HARSH.find((w) => t.includes(w));
  if (hit)
    return {
      ok: false,
      note: `Try rephrasing "${hit}" constructively — what could be improved?`,
    };
  if (/(.)\1{4,}/.test(t) || /[A-Z]{8,}/.test(text))
    return { ok: false, note: "Please avoid shouting or spam-like text." };
  return { ok: true, note: "Looks kind and constructive. Thanks!" };
}
