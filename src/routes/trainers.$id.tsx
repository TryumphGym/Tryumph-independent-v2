import { SessionJoinButton } from "@/components/SessionJoin";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ShieldCheck, ShoppingBag, Star, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TRAINING_TIMES, liveClasses, products, trainers, videos } from "@/lib/data";
import { useStore, reviewCheck, type Review } from "@/lib/store";
import { moderateReview } from "@/lib/moderation.functions";
import { supabase } from "@/integrations/supabase/client";
import { useUserId } from "@/lib/community";
import { createBookingCheckout } from "@/lib/stripe.functions";
import { isTaken, openTimes, type BusyRow } from "@/lib/availability";
import { Avatar } from "@/components/Avatar";
import { isLaunchWorkout } from "@/lib/launch";

export const Route = createFileRoute("/trainers/$id")({
  loader: ({ params }) => {
    const t = trainers.find((x) => x.id === params.id && x.role === "Trainer");
    if (!t) throw notFound();
    return { trainer: t };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Trainer not found — Tryumph Gym" }, { name: "robots", content: "noindex" }] };
    const t = loaderData.trainer;
    return {
      meta: [
        { title: `${t.name} — ${t.role} on Tryumph Gym` },
        { name: "description", content: t.bio },
        { property: "og:title", content: `${t.name} — Tryumph Gym` },
        { property: "og:description", content: t.bio },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => <p className="card p-8 text-center">Trainer not found. <Link to="/trainers" className="text-primary">Back to directory</Link></p>,
  component: TrainerPage,
});

function TrainerPage() {
  const { trainer: t } = Route.useLoaderData();
  const { s, set, uid } = useStore();
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("booked")) {
      toast.success("Payment received — your 1-on-1 is confirmed.");
      const timer = setTimeout(() => window.location.replace(`/trainers/${t.id}`), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [t.id]);

  const payAndBook = async () => {
    if (!s.signedIn) { toast.error("Sign in to book a 1-on-1."); return; }
    if (!date || !time) { toast.error("Pick a date and an open time."); return; }
    if (isTaken(t.id, date, time, busy)) { toast.error(`${t.name.split(" ")[0]} isn't available then — choose another open time.`); return; }
    setPaying(true);
    try {
      const { url } = await createBookingCheckout({ data: { trainerId: t.id, date, time } });
      if (url) window.location.href = url;
      else toast.error("Couldn't start checkout.");
    } catch {
      toast.error("Couldn't start checkout.");
    } finally {
      setPaying(false);
    }
  };
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [today, setToday] = useState("");
  const [busy, setBusy] = useState<BusyRow[]>([]);
  useEffect(() => {
    const iso = new Date().toISOString().slice(0, 10);
    setToday(iso);
    void supabase.from("trainer_busy").select("day, time, source").eq("trainer_id", t.id).gte("day", iso).then(({ data }) => setBusy((data ?? []) as BusyRow[]));
  }, [t.id]);
  useEffect(() => {
    if (!date) return;
    const free = openTimes(t.id, date, busy);
    if (!free.includes(time)) setTime(free[0] ?? "");
  }, [date, busy, t.id, time]);
  const [text, setText] = useState("");
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState<{ ok: boolean; note: string } | null>(null);
  const [dbReviews, setDbReviews] = useState<Review[]>([]);
  const me = useUserId();
  const loadReviews = useCallback(async () => {
    const { data } = await supabase.from("reviews").select("*").eq("trainer_id", t.id).order("created_at", { ascending: false });
    setDbReviews((data ?? []).map((r) => ({ id: r.id, trainerId: r.trainer_id, author: r.author_name, text: r.text, stars: r.stars, reply: r.reply ?? undefined })));
  }, [t.id]);
  useEffect(() => { loadReviews(); }, [loadReviews]);
  // Trainer replies stay on this device until trainer accounts are linked to profiles.
  const reviews = dbReviews.map((r) => ({ ...r, reply: r.reply ?? s.reviews.find((x) => x.id === r.id)?.reply }));
  const merch = products.filter((p) => p.trainerId === t.id);
  const playlists = Object.entries(videos.filter((v) => isLaunchWorkout(v) && v.trainerId === t.id && v.playlist).reduce<Record<string, typeof videos>>((a, v) => { if (v.playlist) (a[v.playlist] ??= []).push(v); return a; }, {}));
  const following = (s.extra.followed ?? []).includes(t.id);
  const toggleFollow = () => {
    if (!s.signedIn) { toast("Sign in to follow coaches."); return; }
    set((x) => { const f = x.extra.followed ?? []; return { ...x, extra: { ...x.extra, followed: f.includes(t.id) ? f.filter((y) => y !== t.id) : [...f, t.id] } }; });
    toast.success(following ? "Unfollowed" : `Following ${t.name.split(" ")[0]} — their classes will show first`);
  };
  const [reply, setReply] = useState<Record<string, string>>({});

  const submitReview = async () => {
    const r = reviewCheck(text);
    setNote(r);
    if (!r.ok) return;
    setNote({ ok: true, note: "Checking your review…" });
    const ai = await moderateReview({ data: { text } }).catch(() => null);
    if (ai && !ai.ok) { setNote({ ok: false, note: ai.note }); return; }
    setNote({ ok: true, note: "Looks kind and helpful — thanks!" });
    if (!s.signedIn || !me) { toast.error("Sign in to leave a review."); return; }
    const { error } = await supabase.from("reviews").insert({ trainer_id: t.id, author_id: me, author_name: s.name, text, stars });
    if (error) { toast.error("Couldn't post review."); return; }
    setText(""); toast.success("Review posted"); loadReviews();
  };

  return (
    <div className="space-y-8">
      <Link to="/trainers" className="text-sm text-muted-foreground">← All trainers</Link>
      <section className="card flex flex-wrap items-center gap-6 p-6">
        <Avatar initials={t.initials} size="lg" />
        <div className="flex-1">
          <p className="eyebrow">{t.role}</p>
          <h1 className="mt-1 text-3xl font-bold">{t.name}</h1>
          <p className="mt-1 text-muted-foreground">{t.bio}</p>
          <div className="mt-3 flex flex-wrap gap-2">{t.quals.map((q) => <span key={q} className="chip">{q}</span>)}{t.specialties.map((q) => <span key={q} className="chip">{q}</span>)}</div>
        </div>
        <div className="text-right"><p className="flex items-center justify-end gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{t.rating}</p><p className="font-display text-2xl font-bold">${t.rate}</p><p className="text-sm text-muted-foreground">per session</p></div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className={`btn ${following ? "btn-primary" : "btn-outline"}`} onClick={toggleFollow}><Star className={`h-4 w-4 ${following ? "fill-current" : ""}`} />{following ? "Following" : "Follow"}</button>
        {merch.length > 0 && <a href="#store" className="btn btn-outline"><ShoppingBag className="h-4 w-4" />{t.name.split(" ")[0]}'s Store & Merch</a>}
        <Link to="/trybes" search={{ t: t.id }} className="btn btn-ghost"><Users className="h-4 w-4" />Join {t.name.split(" ")[0]}'s Trybe · {t.followers.toLocaleString()} members</Link>
      </div>
      {merch.length > 0 && (
        <section id="store" className="scroll-mt-24">
          <h2 className="mb-3 text-xl font-bold">Store & Merch</h2>
          <div className="grid gap-3 sm:grid-cols-3">{merch.map((m) => m.url ? (
            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 text-left hover:border-primary"><ShoppingBag className="h-6 w-6 text-primary" /><span className="flex-1">{m.name}</span><span className="font-semibold">${m.price} ↗</span></a>
          ) : (
            <button key={m.id} onClick={() => toast("Checkout opens soon — we'll notify you!")} className="card flex items-center gap-3 p-4 text-left hover:border-primary"><ShoppingBag className="h-6 w-6 text-primary" /><span className="flex-1">{m.name}</span><span className="font-semibold">${m.price}</span></button>
          ))}</div>
          {merch.some((m) => m.url) && <p className="mt-2 text-xs text-muted-foreground">Some links go to the coach's own shop and may be affiliate links — the coach may earn a commission at no extra cost to you. Purchases there are between you and the coach.</p>}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xl font-bold">Upcoming lives</h2>
            {liveClasses.filter((l) => l.trainerId === t.id).map((l) => <div key={l.id} className="card mb-2 flex justify-between p-4"><span>{l.title}</span><span className="text-sm text-muted-foreground">{l.when}</span></div>)}
            {liveClasses.every((l) => l.trainerId !== t.id) && <p className="text-muted-foreground">No lives scheduled.</p>}
          </section>
          <section>
            <h2 className="mb-3 text-xl font-bold">On-demand</h2>
            <div className="grid gap-2 sm:grid-cols-2">{videos.filter((v) => isLaunchWorkout(v) && v.trainerId === t.id).map((v) => <Link key={v.id} to="/on-demand" search={{ v: v.id }} className="card p-4 hover:border-primary">{v.title}<p className="text-sm text-muted-foreground">{v.minutes} min · {v.category}</p></Link>)}</div>
          </section>
          {playlists.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">Playlists</h2>
              <div className="grid gap-2 sm:grid-cols-2">{playlists.map(([name, vs]) => (
                <div key={name} className="card p-4">
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-muted-foreground">{vs.length} workouts · {vs.reduce((a, v) => a + v.minutes, 0)} min</p>
                  <Link to="/on-demand" search={{ v: vs[0]!.id }} className="mt-2 inline-block text-sm text-primary">Play all →</Link>
                </div>
              ))}</div>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-xl font-bold">Reviews</h2>
            <div className="card mb-4 space-y-3 p-4">
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}><Star className={`h-5 w-5 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} /></button>)}</div>
              <textarea className="field min-h-20" placeholder="Share a kind, honest review…" value={text} onChange={(e) => { setText(e.target.value); setNote(null); }} />
              {note && <p className={`flex items-center gap-2 text-sm ${note.ok ? "text-success" : "text-warning"}`}><ShieldCheck className="h-4 w-4" />{note.note}</p>}
              <button className="btn btn-primary" onClick={submitReview}>Check & post</button>
            </div>
            {reviews.map((r) => (
              <div key={r.id} className="card mb-2 p-4">
                <p className="text-sm font-semibold">{r.author} · {"★".repeat(r.stars)}</p><p className="text-muted-foreground">{r.text}</p>
                {r.reply && <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm"><b>{t.name.split(" ")[0]} replied:</b> {r.reply}</p>}
                {s.signedIn && s.role === "trainer" && !r.reply && (
                  <div className="mt-2 flex gap-2">
                    <input className="field" placeholder="Reply as the trainer…" value={reply[r.id] ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
                    <button className="btn btn-ghost" onClick={() => { const v = reply[r.id]?.trim(); if (!v) return; set((x) => ({ ...x, reviews: [...x.reviews.filter((y) => y.id !== r.id), { ...r, reply: v }] })); }}>Reply</button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
        <aside className="card h-fit space-y-3 p-6">
          <h2 className="text-xl font-bold">Book a 1-on-1</h2>
          <p className="text-sm text-muted-foreground">Private video room · ${t.rate} per session, paid by card</p>
          {t.role === "Nutritionist" && <p className="text-xs text-primary">Booking gives {t.name.split(" ")[0]} access to your weekly menu so they can tailor it for you.</p>}
          <input type="date" className="field" min={today || undefined} value={date} onChange={(e) => setDate(e.target.value)} />
          {!date && <p className="text-sm text-muted-foreground">Pick a date to see {t.name.split(" ")[0]}'s open times.</p>}
          {date && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Open times · {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {TRAINING_TIMES.map((x) => {
                  const gone = isTaken(t.id, date, x, busy);
                  return (
                    <button key={x} type="button" disabled={gone} title={gone ? "Unavailable — no session can be booked then" : "Available"} onClick={() => setTime(x)}
                      className={`rounded-lg px-2 py-2 text-sm font-semibold ${time === x ? "bg-primary text-primary-foreground" : gone ? "bg-secondary text-muted-foreground line-through opacity-60" : "bg-secondary hover:border-primary hover:outline hover:outline-1 hover:outline-primary"}`}>
                      {x}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Crossed-out times are when {t.name.split(" ")[0]} is unavailable or already booked.</p>
            </div>
          )}
          <button className="btn btn-primary w-full" disabled={!date || paying || !time || isTaken(t.id, date, time, busy)} onClick={payAndBook}>
            {!time ? "No times open — try another day" : paying ? "Opening checkout…" : `Book 1-on-1 · $${t.rate}`}
          </button>
          <p className="text-xs text-muted-foreground">Paid securely by card. Your session is confirmed as soon as payment completes.</p>
          {s.bookings.filter((b) => b.trainerId === t.id).map((b) => <div key={b.id} className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-success">✓ Booked {b.date} at {b.time}</p><SessionJoinButton trainerId={t.id} date={b.date} time={b.time} title={`1-on-1 with ${t.name}`} hostName={t.name} /></div>)}
        </aside>
      </div>
    </div>
  );
}
