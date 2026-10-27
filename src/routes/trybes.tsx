import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Heart,
  MessageCircle,
  Pin,
  Send,
  Trash2,
  UserPlus,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  coachTrybeNames,
  goalTrybes,
  isPrivateTrybe,
  trybeName,
} from "@/lib/data";
import { useStore } from "@/lib/store";
import { Avatar, PageHeader } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import {
  useChat,
  useFriendRequests,
  useFriends,
  usePosts,
  useUserId,
} from "@/lib/community";
import { inTrybeFeed } from "@/lib/trybe-feed";
import { Button } from "@/components/ui/button";
import { TrainerStorefront } from "@/components/TrainerStorefront";
import { ReportContent } from "@/components/ReportContent";

export const Route = createFileRoute("/trybes")({
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Trybes Community — Tryumph Gym" },
      {
        name: "description",
        content:
          "Join trainer and goal-based Trybes, add friends and pair up with accountability partners.",
      },
      { property: "og:title", content: "Trybes Community — Tryumph Gym" },
      {
        property: "og:description",
        content:
          "Groups for every trainer and goal, with friends and accountability partners.",
      },
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
  const { incoming, outgoing, reload: reloadRequests } = useFriendRequests(me);
  const [trybe, setTrybe] = useState(t ?? "all");
  const [postVisibility, setPostVisibility] = useState<"public" | "private">(
    "private",
  );
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [directoryCoaches, setDirectoryCoaches] = useState<
    { id: string; name: string }[]
  >([]);
  useEffect(() => {
    let active = true;
    void fetch("/api/public/trainers")
      .then((r) => (r.ok ? r.json() : { trainers: [] }))
      .then((v: { trainers?: { id: string; name: string }[] }) => {
        if (active)
          setDirectoryCoaches(
            (v.trainers ?? []).map((t) => ({
              id: `coach-${t.id}`,
              name: `${t.name}'s Trybe`,
            })),
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [membershipsReady, setMembershipsReady] = useState(false);
  useEffect(() => {
    let active = true;
    setMembershipsReady(false);
    if (!me) {
      setJoinedIds([]);
      setMembershipsReady(true);
      return;
    }
    supabase
      .from("trybe_memberships")
      .select("trybe_id")
      .eq("user_id", me)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Trybe memberships unavailable. Please try again later.");
          setJoinedIds([]);
        } else setJoinedIds((data ?? []).map((x) => x.trybe_id));
        setMembershipsReady(!error);
      });
    return () => {
      active = false;
    };
  }, [me]);
  const changeMembership = async (id: string, join: boolean) => {
    if (!me || !membershipsReady || id === "all") return;
    const result = join
      ? await supabase
          .from("trybe_memberships")
          .insert({ user_id: me, trybe_id: id })
      : await supabase
          .from("trybe_memberships")
          .delete()
          .eq("user_id", me)
          .eq("trybe_id", id);
    if (result.error) {
      if (join && result.error.code === "23505") {
        setJoinedIds((old) => [...new Set([...old, id])]);
        return;
      }
      toast.error(`Could not update Trybe membership: ${result.error.message}`);
      return;
    }
    setJoinedIds((old) =>
      join ? [...new Set([...old, id])] : old.filter((x) => x !== id),
    );
    reload();
  };
  const [text, setText] = useState("");
  const [kind, setKind] = useState("Goal");
  const [comment, setComment] = useState<Record<string, string>>({});
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [alerts, setAlerts] = useState<
    { name: string; title: string; when: string }[]
  >([]);
  const { msgs, refresh: refreshChat } = useChat(me, chatWith);
  const e = s.extra;
  const isMod = s.signedIn && s.role === "trainer";
  const partners = friends.filter((f) => f.partner);
  const partnerIds = partners
    .map((p) => p.friend_id)
    .sort()
    .join(",");
  // Private Trybes: posts are only ever visible to joined members.
  const canSee = (id: string) =>
    id === `coach-${me}` || !isPrivateTrybe(id) || joinedIds.includes(id);
  const locked = trybe !== "all" && trybe !== "discover" && !canSee(trybe);
  const effectiveMemberships =
    s.signedIn && s.role === "trainer" && me
      ? [...new Set([...joinedIds, `coach-${me}`])]
      : joinedIds;
  const visible = all.filter(
    (p) => !p.is_hidden && (p.official === true || canSee(p.trybe)),
  );
  const filtered = visible.filter((p) =>
    trybe === "discover"
      ? p.visibility === "public"
      : (p.official === true && trybe === "all") ||
        inTrybeFeed(p.trybe, trybe, effectiveMemberships),
  );
  const posts = [...filtered].sort(
    (a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned),
  );
  const coaches = directoryCoaches;
  for (const c of coaches) coachTrybeNames[c.id] = c.name;
  const joined =
    joinedIds.includes(trybe) ||
    (s.signedIn && s.role === "trainer" && trybe === `coach-${me}`);
  const isFriend = (id: string | null) =>
    !!id &&
    (friends.some((f) => f.friend_id === id) ||
      incoming.some((r) => r.requester_id === id) ||
      outgoing.some((r) => r.recipient_id === id));
  // Never suggest partners based on private-Trybe activity.
  const suggestions = me
    ? [
        ...new Map(
          filtered
            .filter(
              (p) =>
                p.author_id &&
                p.author_id !== me &&
                !isFriend(p.author_id) &&
                !isPrivateTrybe(p.trybe),
            )
            .flatMap((p) =>
              p.author_id
                ? [
                    [
                      p.author_id,
                      { id: p.author_id, name: p.author_name, trybe: p.trybe },
                    ] as const,
                  ]
                : [],
            ),
        ).values(),
      ].slice(0, 6)
    : [];

  useEffect(() => {
    setTrybe(t ?? "all");
    setText("");
  }, [t]);

  useEffect(() => {
    if (!me || !partnerIds) {
      setAlerts([]);
      return;
    }
    let active = true;
    const authorizedPartners = new Set(partnerIds.split(","));
    const loadPartnerAlerts = async () => {
      const { data: reservations, error } = await supabase.rpc(
        "partner_reservations",
      );
      if (error) {
        console.error("Partner reservations unavailable", error);
        if (active) setAlerts([]);
        return;
      }
      const partnerBySession = new Map<string, Set<string>>();
      for (const partner of reservations ?? []) {
        if (!authorizedPartners.has(partner.friend_id)) continue;
        const ids = Array.isArray(partner.reservations)
          ? partner.reservations
          : [];
        for (const id of ids) {
          if (typeof id !== "string") continue;
          if (!partnerBySession.has(id)) partnerBySession.set(id, new Set());
          partnerBySession.get(id)!.add(partner.friend_name);
        }
      }
      const ids = [...partnerBySession.keys()];
      if (!ids.length) {
        if (active) setAlerts([]);
        return;
      }
      const { data: sessions, error: sessionError } = await supabase
        .from("live_sessions")
        .select("id,title,starts_at,status")
        .in("id", ids)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString());
      if (sessionError) {
        console.error("Partner live sessions unavailable", sessionError);
        if (active) setAlerts([]);
        return;
      }
      const output = (sessions ?? []).flatMap((session) =>
        [...(partnerBySession.get(session.id) ?? [])].map((name) => ({
          name,
          title: session.title,
          when: new Date(session.starts_at).toLocaleString(),
        })),
      );
      if (active) setAlerts(output);
    };
    void loadPartnerAlerts();
    const poll = window.setInterval(() => {
      void loadPartnerAlerts();
    }, 30000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [me, partnerIds]);

  const needAuth = (what: string) => {
    if (!s.signedIn || !me) {
      toast.error(`Sign in to ${what}.`);
      return true;
    }
    return false;
  };
  const target = trybe === "all" ? effectiveMemberships[0] : trybe;
  const canPost =
    trybe !== "discover" &&
    membershipsReady &&
    (trybe === "all"
      ? effectiveMemberships.length > 0
      : joined || trybe === `coach-${me}`);
  const joinTrybe = () => {
    if (needAuth("join a Trybe")) return;
    void changeMembership(trybe, true);
  };
  const post = async () => {
    if (needAuth("post") || !text.trim()) return;
    if (!canPost || !target) {
      toast.error("Join this Trybe to post.");
      return;
    }
    const { error } = await supabase.from("posts").insert({
      author_id: me,
      author_name: s.name,
      trybe: target,
      kind,
      text: text.trim(),
      visibility: target === `coach-${me}` ? postVisibility : "private",
    });
    if (error) {
      toast.error("Couldn't post. Try again.");
      return;
    }
    setText("");
    reload();
  };
  const like = async (id: string, liked: boolean) => {
    if (needAuth("like posts")) return;
    if (!joinedIds.includes(all.find((post) => post.id === id)?.trybe ?? "")) {
      toast.error("Join this Trybe to react to its posts.");
      return;
    }
    if (liked)
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", id)
        .eq("user_id", me!);
    else
      await supabase.from("post_likes").insert({ post_id: id, user_id: me! });
    reload();
  };
  const reply = async (id: string) => {
    const c = comment[id]?.trim();
    if (!c || needAuth("reply")) return;
    if (!joinedIds.includes(all.find((post) => post.id === id)?.trybe ?? "")) {
      toast.error("Join this Trybe to comment.");
      return;
    }
    await supabase
      .from("post_comments")
      .insert({ post_id: id, author_id: me!, author_name: s.name, text: c });
    setComment({ ...comment, [id]: "" });
    reload();
  };
  const removeOwn = async (id: string) => {
    await supabase.from("posts").delete().eq("id", id);
    reload();
  };
  const moderate = async (
    id: string,
    action: "pin" | "hide",
    value: boolean,
  ) => {
    const { error } = await supabase.rpc("moderate_trybe_post", {
      p_post_id: id,
      p_action: action,
      p_value: value,
    });
    if (error) toast.error(error.message);
    else reload();
  };
  const addFriend = async (id: string, name: string) => {
    if (needAuth("send friend requests") || id === me || isFriend(id)) return;
    const { error } = await supabase.from("friend_requests").insert({
      requester_id: me!,
      recipient_id: id,
      requester_name: s.name,
      recipient_name: name,
    });
    if (error) {
      toast.error(`Couldn't send friend request: ${error.message}`);
      return;
    }
    toast.success(`Friend request sent to ${name}`);
    void reloadRequests();
  };
  const respondToRequest = async (requesterId: string, accept: boolean) => {
    if (!me) return;
    const result = accept
      ? await supabase.rpc("accept_friend_request", {
          p_requester_id: requesterId,
        })
      : await supabase
          .from("friend_requests")
          .delete()
          .eq("requester_id", requesterId)
          .eq("recipient_id", me);
    if (result.error) {
      toast.error(
        `Couldn't ${accept ? "accept" : "decline"} request: ${result.error.message}`,
      );
      return;
    }
    toast.success(
      accept ? "Friend request accepted" : "Friend request declined",
    );
    void reloadRequests();
    void reloadFriends();
  };
  const unfriend = async (id: string, name: string) => {
    if (
      !me ||
      !window.confirm(
        `Remove ${name} from your friends? This also ends your accountability partnership.`,
      )
    )
      return;
    const { error } = await supabase.rpc("unfriend_user", { p_friend_id: id });
    if (error) {
      toast.error(`Couldn't unfriend ${name}: ${error.message}`);
      return;
    }
    if (chatWith === id) setChatWith(null);
    toast.success(`${name} removed from friends`);
    void reloadFriends();
    void reloadRequests();
  };
  const togglePartner = async (id: string, on: boolean) => {
    await supabase
      .from("friendships")
      .update({ partner: !on })
      .eq("user_id", me!)
      .eq("friend_id", id);
    reloadFriends();
  };
  const send = async () => {
    if (!chatWith || !msg.trim() || !me) return;
    const { error } = await supabase.from("messages").insert({
      sender_id: me,
      recipient_id: chatWith,
      sender_name: s.name,
      text: msg.trim(),
    });
    if (error) {
      toast.error(`Couldn't send message: ${error.message}`);
      return;
    }
    setMsg("");
    refreshChat();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Community"
        title={
          trybe === "all"
            ? "Your Trybe feed"
            : trybe === `coach-${me}` && s.role === "trainer"
              ? "My Trybe"
              : trybeName(trybe)
        }
        sub={
          trybe === "all"
            ? "Updates from the Trybes you've joined."
            : (goalTrybes.find((g) => g.id === trybe)?.desc ??
              "Classes, tips and encouragement with your coach.")
        }
      />
      {trybe === "all" ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {coaches.map((c) => (
              <Button key={c.id} asChild variant="outline">
                <Link to="/trybes" search={{ t: c.id }}>
                  {c.name}
                </Link>
              </Button>
            ))}
            {goalTrybes.map((g) => (
              <Button key={g.id} asChild variant="outline">
                <Link to="/trybes" search={{ t: g.id }}>
                  {g.private ? "🔒 " : ""}
                  {g.name}
                </Link>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <Button asChild variant="ghost" className="mb-4">
          <Link to="/trybes" search={{}}>
            ← Your Trybe feed
          </Link>
        </Button>
      )}
      {trybe.startsWith("coach-") &&
        /^[0-9a-f-]{36}$/i.test(trybe.slice(6)) && (
          <>
            <TrainerStorefront trainerId={trybe.slice(6)} />
            {me && me !== trybe.slice(6) && (
              <div className="mb-4">
                <ReportContent
                  targetType="trainer"
                  targetId={trybe.slice(6)}
                  label="Report this trainer"
                />
              </div>
            )}
          </>
        )}
      {trybe !== "all" && trybe !== "discover" && (
        <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1">
            <p className="font-semibold">{trybeName(trybe)}</p>
            <p className="text-sm text-muted-foreground">
              {goalTrybes.find((g) => g.id === trybe)?.desc ??
                "Trainer-led group for classes, tips and encouragement."}
            </p>
          </div>
          <button
            className={`btn ${joined ? "btn-ghost" : "btn-primary"}`}
            onClick={() => {
              if (needAuth("join a Trybe")) return;
              void changeMembership(trybe, !joined);
            }}
          >
            {joined ? "Joined ✓" : "Join Trybe"}
          </button>
        </div>
      )}
      <div className="mb-4 flex gap-2">
        <button
          className="btn btn-outline"
          onClick={() => setTrybe("discover")}
        >
          Public discovery
        </button>
        <button className="btn btn-outline" onClick={() => setTrybe("all")}>
          Joined Trybes
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {canPost ? (
            <div className="card space-y-3 p-4">
              <textarea
                className="field min-h-20"
                placeholder="Share a goal, win or fail…"
                value={text}
                onChange={(ev) => setText(ev.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                {["Goal", "Win", "Fail"].map((k) => (
                  <button
                    key={k}
                    className={`chip ${kind === k ? "chip-active" : ""}`}
                    onClick={() => setKind(k)}
                  >
                    {k}
                  </button>
                ))}
                {target === `coach-${me}` && (
                  <select
                    className="field"
                    aria-label="Post visibility"
                    value={postVisibility}
                    onChange={(e) =>
                      setPostVisibility(e.target.value as "public" | "private")
                    }
                  >
                    <option value="private">Trybe members only</option>
                    <option value="public">Public discovery</option>
                  </select>
                )}
                <button className="btn btn-primary ml-auto" onClick={post}>
                  Post
                </button>
              </div>
            </div>
          ) : locked ? (
            <div className="card space-y-3 p-6 text-center">
              <p className="text-lg font-semibold">
                🔒 Private & Confidential Trybe
              </p>
              <p className="text-sm text-muted-foreground">
                Discussions, wins and questions in this group are visible only
                to members. Who has joined is never shown to anyone outside. Tap
                Join to enter the safe space.
              </p>
              <button className="btn btn-primary" onClick={joinTrybe}>
                Join Trybe
              </button>
            </div>
          ) : (
            <div className="card flex flex-wrap items-center gap-3 p-4">
              <p className="flex-1 text-sm text-muted-foreground">
                {trybe === "all"
                  ? "Join a Trybe to see its updates and start posting."
                  : "🔒 Members only — join this Trybe to share wins, goals and questions."}
              </p>
              {trybe !== "all" && trybe !== "discover" && (
                <button className="btn btn-primary" onClick={joinTrybe}>
                  Join Trybe
                </button>
              )}
            </div>
          )}
          {!locked && (
            <>
              {trybe !== "all" && trybe !== "discover" && (
                <div className="card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    📌 Pinned · Tryumph Gym
                  </p>
                  <p className="mt-2 font-semibold">
                    Welcome to the Trybe! Pick a prompt to start:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        [
                          "Win",
                          "New parents: what's one small win from this week? 💪",
                        ],
                        [
                          "Goal",
                          "Naptime sweat check-in — did you get your 15 minutes in today?",
                        ],
                        [
                          "Win",
                          "Favorite quiet, apartment-friendly move? (No jumping allowed 😄)",
                        ],
                        [
                          "Goal",
                          "Introduce yourself: who's in your house and what's your fitness goal?",
                        ],
                      ] as const
                    ).map(([k, t]) => (
                      <button
                        key={t}
                        className="chip text-left"
                        onClick={() => {
                          setKind(k);
                          setText(t + "\n");
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {posts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No posts here yet — be the first!
                </p>
              )}
              {posts.map((p) => (
                <div key={p.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar
                      size="sm"
                      initials={p.author_name.slice(0, 2).toUpperCase()}
                    />
                    <p className="font-semibold">
                      {p.official === true ? "Tryumph Gym" : p.author_name}
                    </p>
                    {p.official === true && (
                      <span className="chip chip-active">
                        Official announcement
                      </span>
                    )}
                    {!p.official &&
                      p.author_id &&
                      p.author_id !== me &&
                      !isFriend(p.author_id) && (
                        <button
                          className="flex items-center gap-1 text-xs text-primary"
                          onClick={() => addFriend(p.author_id!, p.author_name)}
                        >
                          <UserPlus className="h-3 w-3" />
                          Add friend
                        </button>
                      )}
                    {isFriend(p.author_id) && (
                      <span className="text-xs text-muted-foreground">
                        Friend
                      </span>
                    )}
                    <span className="chip">
                      {p.kind.toLowerCase() === "text" ? "Post" : p.kind}
                    </span>
                    {p.is_pinned && (
                      <span className="chip chip-active">📌 Pinned</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {trybeName(p.trybe)}
                    </span>
                  </div>
                  {!p.official && me && p.author_id && p.author_id !== me && (
                    <ReportContent
                      targetType="user"
                      targetId={p.author_id}
                      label="Report user"
                    />
                  )}
                  <p className="mt-3">{p.text}</p>
                  {me && p.author_id !== me && (
                    <ReportContent
                      targetType="post"
                      targetId={p.id}
                      label="Report post"
                    />
                  )}
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    <button
                      className={`flex items-center gap-1 ${p.liked ? "text-primary" : ""}`}
                      onClick={() => like(p.id, p.liked)}
                    >
                      <Heart
                        className={`h-4 w-4 ${p.liked ? "fill-primary" : ""}`}
                      />
                      {p.likes}
                    </button>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {p.comments.length}
                    </span>
                    {p.author_id && p.author_id === me && (
                      <button
                        className="ml-auto flex items-center gap-1"
                        onClick={() => removeOwn(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                    {isMod &&
                      p.trybe === `coach-${me}` &&
                      p.author_id !== me && (
                        <>
                          <button
                            className="ml-auto flex items-center gap-1"
                            onClick={() =>
                              void moderate(p.id, "pin", !p.is_pinned)
                            }
                          >
                            <Pin className="h-4 w-4" />
                            {p.is_pinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            className="flex items-center gap-1 text-destructive"
                            onClick={() => void moderate(p.id, "hide", true)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Hide
                          </button>
                        </>
                      )}
                  </div>
                  {p.comments.map((c) => (
                    <div
                      key={c.id}
                      className="mt-2 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                    >
                      <span>
                        <b>{c.author_name}:</b> {c.text}
                      </span>
                      {me && c.author_id !== me && (
                        <ReportContent
                          targetType="user"
                          targetId={c.author_id}
                          label="Report user"
                        />
                      )}
                      {me && c.author_id !== me && (
                        <ReportContent
                          targetType="comment"
                          targetId={c.id}
                          label="Report comment"
                        />
                      )}
                      {c.author_id !== me && !isFriend(c.author_id) && (
                        <button
                          className="ml-auto text-xs text-primary"
                          onClick={() => addFriend(c.author_id, c.author_name)}
                        >
                          Add friend
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="mt-3 flex gap-2">
                    <input
                      className="field"
                      placeholder="Say something encouraging…"
                      value={comment[p.id] ?? ""}
                      onChange={(ev) =>
                        setComment({ ...comment, [p.id]: ev.target.value })
                      }
                    />
                    <button
                      className="btn btn-ghost"
                      onClick={() => reply(p.id)}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <aside className="space-y-4">
          <div className="card p-5">
            <p className="eyebrow">Find accountability partners</p>
            {!me && (
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to meet members and pair up.
              </p>
            )}
            {me && suggestions.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                No new members to suggest yet — post a goal and others can find
                you.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {suggestions.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  <Avatar
                    size="sm"
                    initials={u.name.slice(0, 2).toUpperCase()}
                  />
                  <span className="flex-1">
                    {u.name}
                    <span className="block text-xs text-muted-foreground">
                      Active in {trybeName(u.trybe)}
                    </span>
                  </span>
                  <button
                    className="chip"
                    onClick={() => addFriend(u.id, u.name)}
                  >
                    <UserPlus className="h-3 w-3" />
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <p className="eyebrow">
              Friend requests{" "}
              {incoming.length > 0 ? `(${incoming.length})` : ""}
            </p>
            {incoming.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                No pending requests.
              </p>
            )}
            <ul className="mt-3 space-y-3">
              {incoming.map((request) => (
                <li
                  key={request.requester_id}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="flex-1">{request.requester_name}</span>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      void respondToRequest(request.requester_id, true)
                    }
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      void respondToRequest(request.requester_id, false)
                    }
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
            {outgoing.length > 0 && (
              <>
                <p className="eyebrow mt-4">Sent requests</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {outgoing.map((request) => (
                    <li key={request.recipient_id}>
                      {request.recipient_name} · Pending
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="card p-5">
            <p className="eyebrow">Friends</p>
            {friends.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Send friend requests from suggestions, posts and replies. Once
                accepted, tap "Make partner" to get a private chat and alerts
                when they reserve a live.
              </p>
            )}
            <ul className="mt-3 space-y-2">
              {friends.map((f) => (
                <li
                  key={f.friend_id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Avatar
                    size="sm"
                    initials={f.friend_name.slice(0, 2).toUpperCase()}
                  />
                  {f.friend_name}
                  {me && f.friend_id !== me && (
                    <ReportContent
                      targetType="user"
                      targetId={f.friend_id}
                      label="Report user"
                    />
                  )}
                  <button
                    className={`ml-auto chip ${f.partner ? "chip-active" : ""}`}
                    onClick={() => togglePartner(f.friend_id, f.partner)}
                  >
                    {f.partner ? "Partner ✓" : "Make partner"}
                  </button>
                  <button
                    type="button"
                    className="chip text-destructive"
                    onClick={() => void unfriend(f.friend_id, f.friend_name)}
                  >
                    Unfriend
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {partners.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow">Partner alerts</p>
              {alerts.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  When a partner who has also added you reserves a live class,
                  it shows up here.
                </p>
              )}
              <ul className="mt-2 space-y-2 text-sm">
                {alerts.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      <b>{a.name}</b> reserved {a.title} ({a.when}).{" "}
                      <Link to="/live" className="text-primary">
                        Join them
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {friends.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow">Messages</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Private conversations with accepted friends. Accountability
                partners are marked below.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {friends.map((p) => (
                  <button
                    key={p.friend_id}
                    className={`chip ${chatWith === p.friend_id ? "chip-active" : ""}`}
                    onClick={() => setChatWith(p.friend_id)}
                  >
                    {p.friend_name}
                    {p.partner ? " · Partner" : ""}
                  </button>
                ))}
              </div>
              {chatWith && (
                <>
                  {chatWith !== me && (
                    <div className="mt-2">
                      <ReportContent
                        targetType="user"
                        targetId={chatWith}
                        label="Report chat partner"
                      />
                    </div>
                  )}
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {msgs.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Start your conversation 💪
                      </p>
                    )}
                    {msgs.map((c) => (
                      <p
                        key={c.id}
                        className={`rounded-lg px-3 py-2 text-sm ${c.sender_id === me ? "ml-6 bg-primary/15" : "mr-6 bg-secondary"}`}
                      >
                        {c.sender_id !== me && <b>{c.sender_name}: </b>}
                        {c.text}
                      </p>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      className="field"
                      value={msg}
                      onChange={(ev) => setMsg(ev.target.value)}
                      placeholder="Message…"
                      onKeyDown={(ev) => ev.key === "Enter" && send()}
                    />
                    <button
                      className="btn btn-primary"
                      aria-label="Send"
                      onClick={send}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
