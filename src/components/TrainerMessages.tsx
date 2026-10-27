import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@/lib/community";
import { useUserId } from "@/lib/community";
import { toast } from "sonner";

type Contact = { id: string; name: string; last: string; updated: string };
export function TrainerMessages({ selectedTrainerId }: { selectedTrainerId?: string }) {
  const me = useUserId();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(selectedTrainerId ?? null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const msgs = useChat(me, selected);
  const refresh = async () => {
    if (!me) return;
    const { data, error } = await supabase.from("messages")
      .select("sender_id,recipient_id,sender_name,text,created_at")
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order("created_at", { ascending: false }).limit(200);
    if (error) { toast.error("Unable to load messages"); return; }
    const ids = [...new Set((data ?? []).map(row => row.sender_id === me ? row.recipient_id : row.sender_id))];
    if (!ids.length) { setContacts([]); return; }
    const profiles = await supabase.from("profiles").select("id,name").in("id",ids);
    const names = new Map((profiles.data ?? []).map(p => [p.id,p.name]));
    setContacts(ids.map(id => {
      const row = (data ?? []).find(r => r.sender_id === id || r.recipient_id === id)!;
      return { id, name: names.get(id) || (row.sender_id === id ? row.sender_name : "Member"), last: row.text, updated: row.created_at };
    }));
  };
  useEffect(() => { void refresh(); }, [me]);
  useEffect(() => { if (selectedTrainerId) setSelected(selectedTrainerId); }, [selectedTrainerId]);
  async function send() {
    if (!me || !selected || !draft.trim() || busy) return;
    setBusy(true);
    const { data: profile } = await supabase.from("profiles").select("name").eq("id",me).maybeSingle();
    const { error } = await supabase.from("messages").insert({
      sender_id: me, recipient_id: selected, sender_name: profile?.name ?? "Member", text: draft.trim().slice(0,2000),
    });
    setBusy(false);
    if (error) { toast.error("Could not send. Trainer inquiries require a messaging permission update."); return; }
    setDraft("");
    void refresh();
  }
  if (!me) return <p className="card p-5">Sign in to message trainers.</p>;
  return <section className="card space-y-3 p-5">
    <h2 className="text-xl font-bold">Messages</h2>
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="space-y-1 border-r pr-2">
        {contacts.map(c => <button key={c.id} className={`block w-full rounded p-2 text-left text-sm ${selected === c.id ? "bg-secondary" : ""}`} onClick={() => setSelected(c.id)}>
          <strong>{c.name}</strong><p className="truncate text-xs text-muted-foreground">{c.last}</p>
        </button>)}
        {selected && !contacts.some(c=>c.id===selected) && <p className="text-sm">New trainer inquiry</p>}
      </div>
      <div className="space-y-3">
        {selected ? <>
          <div className="max-h-80 space-y-2 overflow-auto">
            {msgs.map(m => <p key={m.id} className={`rounded-lg p-2 text-sm ${m.sender_id === me ? "bg-primary/10" : "bg-secondary"}`}><strong>{m.sender_name}: </strong>{m.text}</p>)}
            {!msgs.length && <p className="text-sm text-muted-foreground">Ask about one-on-one availability, equipment, or training style.</p>}
          </div>
          <textarea className="field" maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write a message…" />
          <button className="btn btn-primary" disabled={busy || !draft.trim()} onClick={()=>void send()}>{busy ? "Sending…" : "Send message"}</button>
        </> : <p className="text-sm text-muted-foreground">Choose a conversation to reply.</p>}
      </div>
    </div>
  </section>;
}
