import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Pin, Send, Trash2, UserPlus, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { coachTrybeNames, goalTrybes, isPrivateTrybe, liveClasses, trybeName } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useChat, useFriends, usePosts, useUserId } from "@/lib/community";
import { inTrybeFeed } from "@/lib/trybe-feed";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trybes")({
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Trybes Community — Tryumph Gym" },
      { name: "description", content: "Join trainer and goal-based Trybes, add friends and pair up with accountability partners." },
      { property: "og:title", content: "Trybes Community — Tryumph Gym" },
      { property: "og:description", content: "Groups for every trainer and goal, with friends and accountability partners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Trybes,
});

function Trybes() {
  const { t } = Route.useSearch();
  const { s, setExtra } = useStore();
  const me = useUserId();
  const { posts: all, reload } = usePosts(me);
  const { friends, reload: reloadFriends } = useFriends(me);
  const [trybe, setTrybe] = useState(t ?? "all");
  const [text, setText] = useState("");
  const [kind, setKind] = useState("Goal");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [alerts, setAlerts] = useState<{ name: string; title: string; when: string }[]>([]);
  const msgs = useChat(me, chatWith);
  const e = s.extra;
  const isMod = s.signedIn && s.role === "trainer";
  const partners = friends.filter((f) => f.partner);
  // Private Trybes: posts are only ever visible to joined members.
  const canSee = (id: string) => !isPrivateTrybe(id) || e.joinedTrybes.includes(id);
  const locked = trybe !== "all" && !canSee(trybe);
  const visible = all.filter((p) => !e.trainer.removed.includes(p.id) && canSee(p.trybe));
  const filtered = visible.filter((p) => inTrybeFeed(p.trybe, trybe, e.joinedTrybes));
  const posts = [...filtered].sort((a, b) => Number(e.trainer.pinned.includes(b.id)) - Number(e.trainer.pinned.includes(a.id)));
  const coaches = [...new Map(all.filter((p) => p.trybe.startsWith("coach-")).map((p) => [p.trybe, { id: p.trybe, name: `${p.author_name.split(" ")[0]}'s Trybe` }])).values()];
  for (const c of coaches) coachTrybeNames[c.id] = c.name;
  const joined = e.joinedTrybes.includes(trybe);
  const isFriend = (id: string | null) => !!id && friends.some((f) => f.friend_id === id);
  // Never suggest partners based on private-Trybe activity.
  const suggestions = me ? [...new Map(filtered.filter((p) => p.author_id && p.author_id !== me && !isFriend(p.author_id) && !isPrivateTrybe(p.trybe)).flatMap((p) => p.author_id ? [[p.author_id, { id: p.author_id, name: p.author_name, trybe: p.trybe }] as const] : [])).values()].slice(0, 6) : [];

  useEffect(() => { setTrybe(t ?? "all"); setText(""); }, [t]);

  useEffect(() => {
    if (!me || partners.length === 0) { setAlerts([]); return; }
    supabase.rpc("partner_reservations").then(({ data }) => {
      const out: { name: string; title: string; when: string }[] = [];
      for (const r of data ?? []) {
        const ids = Array.isArray(r.reservations) ? (r.reservations as string[]) : [];
        for (const id of ids) { const l = liveClasses.find((x) => x.id === id); if (l) out.push({ name: r.friend_name, title: l.title, when: l.when }); }
      }
      setAlerts(out);
    });
  }, [me, partners.length]);

  const needAuth = (what: string) => { if (!s.signedIn || !me) { toast.error(`Sign in to ${what}.`); return true; } return false; };
  const target = trybe === "all" ? e.joinedTrybes[0] : trybe;
  const canPost = trybe === "all" ? e.joinedTrybes.length > 0 : joined;
  const joinTrybe = () => { if (needAuth("join a Trybe")) return; setExtra((x) => ({ ...x, joinedTrybes: x.joinedTrybes.includes(trybe) ? x.joinedTrybes : [...x.joinedTrybes, trybe] })); toast.success(`Welcome to ${trybeName(trybe)}!`); };
  const post = async () => {
    if (needAuth("post") || !text.trim()) return;
    if (!canPost || !target) { toast.error("Join this Trybe to post."); return; }
    const { error } = await supabase.from("posts").insert({ author_id: me, author_name: s.name, trybe: target, kind, text: text.trim() });
    if (error) { toast.error("Couldn't post. Try again."); return; }
    setText(""); reload();
  };
  const like = async (id: string, liked: boolean) => {
    if (needAuth("like posts")) return;
    if (liked) await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", me!);
    else await supabase.from("post_likes").insert({ post_id: id, user_id: me! });
    reload();
  };
  const reply = async (id: string) => {
    const c = comment[id]?.trim();
    if (!c || needAuth("reply")) return;
    await supabase.from("post_comments").insert({ post_id: id, author_id: me!, author_name: s.name, text: c });
    setComment({ ...comment, [id]: "" }); reload();
  };
  const removeOwn = async (id: string) => { await supabase.from("posts").delete().eq("id", id); reload(); };
  const addFriend = async (id: string, name: string) => {
    if (needAuth("add friends") || id === me) return;
    const { error } = await supabase.from("friendships").insert({ user_id: me!, friend_id: id, friend_name: name });
    if (error) { toast.error("Couldn't add friend."); return; }
    toast.success(`${name} added as a friend`); reloadFriends();
  };
  const togglePartner = async (id: string, on: boolean) => {
    await supabase.from("friendships").update({ partner: !on }).eq("user_id", me!).eq("friend_id", id);
    reloadFriends();
  };
  const send = async () => {
    if (!chatWith || !msg.trim() || !me) return;
    const { error } = await supabase.from("messages").insert({ sender_id: me, recipient_id: chatWith, sender_name: s.name, text: msg.trim() });
    if (error) { toast.error("Couldn't send message."); return; }
    setMsg("");
  };

  return (
    <div>
      <PageHeader eyebrow="Community" title={trybe === "all" ? "Your Trybe feed" : trybeName(trybe)} sub={trybe === "all" ? "Updates from the Trybes you've joined." : goalTrybes.find((g) => g.id === trybe)?.desc ?? "Classes, tips and encouragement with your coach."} />
      {trybe === "all" ? <>
        <div className="mb-6 flex flex-wrap gap-2">
          {coaches.map((c) => <Button key={c.id} asChild variant="outline"><Link to="/trybes" search={{ t: c.id }}>{c.name}</Link></Button>)}
          {goalTrybes.map((g) => <Button key={g.id} asChild variant="outline"><Link to="/trybes" search={{ t: g.id }}>{g.private ? "🔒 " : ""}{g.name}</Link></Button>)}
        </div>
      </> : <Button asChild variant="ghost" className="mb-4"><Link to="/trybes" search={{}}>← Your Trybe feed</Link></Button>}
      {trybe !== "all" && (
        <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1"><p className="font-semibold">{trybeName(trybe)}</p><p className="text-sm text-muted-foreground">{goalTrybes.find((g) => g.id === trybe)?.desc ?? "Trainer-led group for classes, tips and encouragement."}</p></div>
          <button className={`btn ${joined ? "btn-ghost" : "btn-primary"}`} onClick={() => { if (needAuth("join a Trybe")) return; setExtra((x) => ({ ...x, joinedTrybes: joined ? x.joinedTrybes.filter((y) => y !== trybe) : [...x.joinedTrybes, trybe] })); }}>{joined ? "Joined ✓" : "Join Trybe"}</button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {canPost ? (
          <div className="card space-y-3 p-4">
            <textarea className="field min-h-20" placeholder="Share a goal, win or fail…" value={text} onChange={(ev) => setText(ev.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              {["Goal", "Win", "Fail"].map((k) => <button key={k} className={`chip ${kind === k ? "chip-active" : ""}`} onClick={() => setKind(k)}>{k}</button>)}
              <button className="btn btn-primary ml-auto" onClick={post}>Post</button>
            </div>
          </div>
          ) : (
          locked ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-lg font-semibold">🔒 Private & Confidential Trybe</p>
            <p className="text-sm text-muted-foreground">Discussions, wins and questions in this group are visible only to members. Who has joined is never shown to anyone outside. Tap Join to enter the safe space.</p>
            <button className="btn btn-primary" onClick={joinTrybe}>Join Trybe</button>
          </div>
          ) : (
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <p className="flex-1 text-sm text-muted-foreground">
              {trybe === "all" ? "Join a Trybe to see its updates and start posting." : "🔒 Members only — join this Trybe to share wins, goals and questions."}
            </p>
            {trybe !== "all" && <button className="btn btn-primary" onClick={joinTrybe}>Join Trybe</button>}
          </div>
          ))}
          {!locked && <>
          {trybe !== "all" &&
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">📌 Pinned · Tryumph Team</p>
            <p className="mt-2 font-semibold">Welcome to the Trybe! Pick a prompt to start:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                ["Win", "New parents: what's one small win from this week? 💪"],
                ["Goal", "Naptime sweat check-in — did you get your 15 minutes in today?"],
                ["Win", "Favorite quiet, apartment-friendly move? (No jumping allowed 😄)"],
                ["Goal", "Introduce yourself: who's in your house and what's your fitness goal?"],
              ] as const).map(([k, t]) => (
                <button key={t} className="chip text-left" onClick={() => { setKind(k); setText(t + "\n"); }}>{t}</button>
              ))}
            </div>
          </div>}
          {posts.length === 0 && <p className="text-sm text-muted-foreground">No posts here yet — be the first!</p>}
          {posts.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar size="sm" initials={p.author_name.slice(0, 2).toUpperCase()} />
                <p className="font-semibold">{p.author_name}</p>
                {p.author_id && p.author_id !== me && !isFriend(p.author_id) && <button className="flex items-center gap-1 text-xs text-primary" onClick={() => addFriend(p.author_id!, p.author_name)}><UserPlus className="h-3 w-3" />Add friend</button>}
                {isFriend(p.author_id) && <span className="text-xs text-muted-foreground">Friend</span>}
                <span className="chip">{p.kind}</span>
                {e.trainer.pinned.includes(p.id) && <span className="chip chip-active">📌 Pinned</span>}
                <span className="ml-auto text-xs text-muted-foreground">{trybeName(p.trybe)}</span>
              </div>
              <p className="mt-3">{p.text}</p>
              <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                <button className={`flex items-center gap-1 ${p.liked ? "text-primary" : ""}`} onClick={() => like(p.id, p.liked)}><Heart className={`h-4 w-4 ${p.liked ? "fill-primary" : ""}`} />{p.likes}</button>
                <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4" />{p.comments.length}</span>
                {p.author_id && p.author_id === me && <button className="ml-auto flex items-center gap-1" onClick={() => removeOwn(p.id)}><Trash2 className="h-4 w-4" />Delete</button>}
                {isMod && p.author_id !== me && <>
                  <button className="ml-auto flex items-center gap-1" onClick={() => setExtra((x) => ({ ...x, trainer: { ...x.trainer, pinned: x.trainer.pinned.includes(p.id) ? x.trainer.pinned.filter((y) => y !== p.id) : [...x.trainer.pinned, p.id] } }))}><Pin className="h-4 w-4" />Pin</button>
                  <button className="flex items-center gap-1 text-destructive" onClick={() => { setExtra((x) => ({ ...x, trainer: { ...x.trainer, removed: [...x.trainer.removed, p.id] } })); toast("Post hidden by moderator"); }}><Trash2 className="h-4 w-4" />Remove</button>
                </>}
              </div>
              {p.comments.map((c) => (
                <div key={c.id} className="mt-2 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                  <span><b>{c.author_name}:</b> {c.text}</span>
                  {c.author_id !== me && !isFriend(c.author_id) && <button className="ml-auto text-xs text-primary" onClick={() => addFriend(c.author_id, c.author_name)}>Add friend</button>}
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <input className="field" placeholder="Say something encouraging…" value={comment[p.id] ?? ""} onChange={(ev) => setComment({ ...comment, [p.id]: ev.target.value })} />
                <button className="btn btn-ghost" onClick={() => reply(p.id)}>Reply</button>
              </div>
            </div>
          ))}
          </>}
        </div>
        <aside className="space-y-4">
          <div className="card p-5">
            <p className="eyebrow">Find accountability partners</p>
            {!me && <p className="mt-2 text-sm text-muted-foreground">Sign in to meet members and pair up.</p>}
            {me && suggestions.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No new members to suggest yet — post a goal and others can find you.</p>}
            <ul className="mt-3 space-y-2">
              {suggestions.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  <Avatar size="sm" initials={u.name.slice(0, 2).toUpperCase()} /><span className="flex-1">{u.name}<span className="block text-xs text-muted-foreground">Active in {trybeName(u.trybe)}</span></span>
                  <button className="chip" onClick={() => addFriend(u.id, u.name)}><UserPlus className="h-3 w-3" />Add</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Friends</p>
            {friends.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Add friends from suggestions, posts and replies. Then tap "Make partner" to get a private chat and alerts when they reserve a live.</p>}
            <ul className="mt-3 space-y-2">
              {friends.map((f) => (
                <li key={f.friend_id} className="flex items-center gap-2 text-sm">
                  <Avatar size="sm" initials={f.friend_name.slice(0, 2).toUpperCase()} />{f.friend_name}
                  <button className={`ml-auto chip ${f.partner ? "chip-active" : ""}`} onClick={() => togglePartner(f.friend_id, f.partner)}>{f.partner ? "Partner ✓" : "Make partner"}</button>
                </li>
              ))}
            </ul>
          </div>
          {partners.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow">Partner alerts</p>
              {alerts.length === 0 && <p className="mt-2 text-sm text-muted-foreground">When a partner who has also added you reserves a live class, it shows up here.</p>}
              <ul className="mt-2 space-y-2 text-sm">{alerts.map((a, i) => <li key={i} className="flex gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span><b>{a.name}</b> reserved {a.title} ({a.when}). <Link to="/live" className="text-primary">Join them</Link></span></li>)}</ul>
            </div>
          )}
          {partners.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow">Accountability chat</p>
              <div className="mt-2 flex flex-wrap gap-2">{partners.map((p) => <button key={p.friend_id} className={`chip ${chatWith === p.friend_id ? "chip-active" : ""}`} onClick={() => setChatWith(p.friend_id)}>{p.friend_name}</button>)}</div>
              {chatWith && <>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                  {msgs.length === 0 && <p className="text-sm text-muted-foreground">Say hi and set a goal together 💪</p>}
                  {msgs.map((c) => <p key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.sender_id === me ? "ml-6 bg-primary/15" : "mr-6 bg-secondary"}`}>{c.sender_id !== me && <b>{c.sender_name}: </b>}{c.text}</p>)}
                </div>
                <div className="mt-3 flex gap-2">
                  <input className="field" value={msg} onChange={(ev) => setMsg(ev.target.value)} placeholder="Message…" onKeyDown={(ev) => ev.key === "Enter" && send()} />
                  <button className="btn btn-primary" aria-label="Send" onClick={send}><Send className="h-4 w-4" /></button>
                </div>
              </>}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
