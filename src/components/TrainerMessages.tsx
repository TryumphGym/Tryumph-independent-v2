import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@/lib/community";
import { useUserId } from "@/lib/community";
import { ReportContent } from "./ReportContent";
import { toast } from "sonner";

type Contact = {
  id: string;
  name: string;
  last: string;
  updated: string;
  incoming: boolean;
};
export function TrainerMessages({
  selectedTrainerId,
}: {
  selectedTrainerId?: string;
}) {
  const me = useUserId();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(
    selectedTrainerId ?? null,
  );
  const [draft, setDraft] = useState("");
  const [controls, setControls] = useState<
    Record<string, { blocked: boolean; muted: boolean; read_at: string | null }>
  >({});
  const [busy, setBusy] = useState(false);
  const { msgs, refresh: refreshChat } = useChat(me, selected);
  const refresh = async () => {
    if (!me) return;
    const controlRows = await supabase
      .from("message_controls")
      .select("other_id,blocked,muted,read_at")
      .eq("user_id", me);
    if (!controlRows.error)
      setControls(
        Object.fromEntries(
          (controlRows.data ?? []).map((r) => [r.other_id, r]),
        ),
      );
    const { data, error } = await supabase
      .from("messages")
      .select("sender_id,recipient_id,sender_name,text,created_at")
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast.error("Unable to load messages");
      return;
    }
    const ids = [
      ...new Set(
        (data ?? []).map((row) =>
          row.sender_id === me ? row.recipient_id : row.sender_id,
        ),
      ),
    ];
    if (!ids.length) {
      setContacts([]);
      return;
    }
    const profiles = await supabase.rpc("message_contact_names");
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.name]));
    setContacts(
      ids.map((id) => {
        const row = (data ?? []).find(
          (r) => r.sender_id === id || r.recipient_id === id,
        )!;
        return {
          id,
          name:
            names.get(id) ||
            (row.sender_id === id ? row.sender_name : "Member"),
          last: row.text,
          updated: row.created_at,
          incoming: row.recipient_id === me,
        };
      }),
    );
  };
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [me]);
  useEffect(() => {
    if (!me || !selected) return;
    void supabase
      .from("message_controls")
      .upsert({
        user_id: me,
        other_id: selected,
        read_at: new Date().toISOString(),
      })
      .then((r) => {
        if (r.error) toast.error("Unable to update read state");
      });
  }, [me, selected, msgs.length]);
  async function control(key: "blocked" | "muted") {
    if (!me || !selected) return;
    const current = controls[selected] ?? {
      blocked: false,
      muted: false,
      read_at: null,
    };
    const result = await supabase.from("message_controls").upsert({
      user_id: me,
      other_id: selected,
      ...current,
      [key]: !current[key],
    });
    if (result.error) toast.error("Unable to save message control");
    else void refresh();
  }
  useEffect(() => {
    if (selectedTrainerId) setSelected(selectedTrainerId);
  }, [selectedTrainerId]);
  async function send() {
    if (!me || !selected || !draft.trim() || busy) return;
    setBusy(true);
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", me)
      .maybeSingle();
    const { error } = await supabase.from("messages").insert({
      sender_id: me,
      recipient_id: selected,
      sender_name: profile?.name ?? "Member",
      text: draft.trim().slice(0, 2000),
    });
    setBusy(false);
    if (error) {
      toast.error(
        "Could not send. Check account eligibility, blocks or the message limit and try again.",
      );
      return;
    }
    setDraft("");
    refreshChat();
    void refresh();
  }
  if (!me) return <p className="card p-5">Sign in to message trainers.</p>;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-xl font-bold">Messages</h2>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="space-y-1 border-r pr-2">
          {contacts.map((c) => (
            <button
              key={c.id}
              className={`block w-full rounded p-2 text-left text-sm ${selected === c.id ? "bg-secondary" : ""}`}
              onClick={() => setSelected(c.id)}
            >
              <strong>
                {c.name}
                {c.incoming &&
                !controls[c.id]?.muted &&
                (!controls[c.id]?.read_at ||
                  c.updated > controls[c.id]!.read_at!)
                  ? " · Unread"
                  : ""}
              </strong>
              <p className="truncate text-xs text-muted-foreground">{c.last}</p>
            </button>
          ))}
          {selected && !contacts.some((c) => c.id === selected) && (
            <p className="text-sm">New trainer inquiry</p>
          )}
        </div>
        <div className="space-y-3">
          {selected ? (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  className="btn btn-outline"
                  onClick={() => void control("blocked")}
                >
                  {controls[selected]?.blocked ? "Unblock" : "Block"}
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => void control("muted")}
                >
                  {controls[selected]?.muted ? "Unmute" : "Mute unread alerts"}
                </button>
                <ReportContent
                  targetType="user"
                  targetId={selected}
                  label="Report account"
                />
              </div>
              <div className="max-h-80 space-y-2 overflow-auto">
                {msgs.map((m) => (
                  <p
                    key={m.id}
                    className={`rounded-lg p-2 text-sm ${m.sender_id === me ? "bg-primary/10" : "bg-secondary"}`}
                  >
                    <strong>{m.sender_name}: </strong>
                    {m.text}
                    {m.sender_id !== me && (
                      <span className="ml-2">
                        <ReportContent
                          targetType="message"
                          targetId={m.id}
                          label="Report this message"
                        />
                      </span>
                    )}
                  </p>
                ))}
                {!msgs.length && (
                  <p className="text-sm text-muted-foreground">
                    Ask about one-on-one availability, equipment, or training
                    style.
                  </p>
                )}
              </div>
              <textarea
                className="field"
                maxLength={2000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
              />
              <button
                className="btn btn-primary"
                disabled={busy || !draft.trim() || controls[selected]?.blocked}
                onClick={() => void send()}
              >
                {busy ? "Sending…" : "Send message"}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Choose a conversation to reply.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
