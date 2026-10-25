import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore, type Cert } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export function RolePicker() {
  const { s, setExtra } = useStore();
  const tr = s.extra.trainer;
  const upd = (kind: typeof tr.kind) => setExtra((x) => ({ ...x, trainer: { ...x.trainer, kind } }));
  return <p className="text-sm font-semibold">Fitness trainer</p>;
  /* Paused nutrition role selection; preserve existing account kinds.
  return (
    <div>
      <p className="mb-2 font-semibold">I coach as… <span className="text-sm font-normal text-muted-foreground">(pick one or both)</span></p>
      <div className="flex gap-2">
        {(["Trainer", "Nutritionist"] as const).map((k) => {
          const on = tr.kind === k || tr.kind === "Both";
          const other = k === "Trainer" ? "Nutritionist" : "Trainer";
          const otherOn = tr.kind === other || tr.kind === "Both";
          return <button key={k} className={`chip flex-1 ${on ? "chip-active" : ""}`} onClick={() => { if (on && !otherOn) return; upd(on ? other : otherOn ? "Both" : k); }}>{k}</button>;
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tr.kind === "Nutritionist" ? "Nutrition dashboard: 1-on-1 consults and client menus. No live classes." : tr.kind === "Both" ? "Full access: live classes, on-demand videos, 1-on-1s and client menus." : "Training dashboard: live classes, on-demand videos and 1-on-1s."}
      </p>
    </div>
  ); */
}

export function CertManager() {
  const { s, setExtra } = useStore();
  const tr = s.extra.trainer;
  const [c, setC] = useState({ name: "", credentialId: "", expires: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<{ id: string; name: string; credential_id: string; status: string; document_path: string | null }[]>([]);
  const reload = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setRecords([]); return; }
    const { data, error } = await supabase.from("certifications").select("id,name,credential_id,status,document_path").eq("user_id", auth.user.id).order("created_at", { ascending: false });
    if (error) toast.error("Could not load certifications");
    else setRecords(data ?? []);
  };
  useEffect(() => { void reload(); }, [s.signedIn]);
  const add = async () => {
    if (!c.name.trim() || !file || busy) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { toast.error("Sign in to submit certifications."); return; }
    if (!(["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 10 * 1024 * 1024) {
      toast.error("Upload a PDF or image under 10 MB."); return;
    }
    setBusy(true);
    const path = `${auth.user.id}/${crypto.randomUUID()}.${({"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as Record<string,string>)[file.type]}`;
    try {
      const upload = await supabase.storage.from("trainer-certificates").upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;
      // Store the private object key in the dedicated document_path column.
      const { data, error } = await supabase.from("certifications").insert({ user_id: auth.user.id, trainer_name: s.name, name: c.name.trim(), credential_id: c.credentialId.trim(), expires: c.expires, document_path: path, status: "pending" }).select("id").single();
      if (error) { await supabase.storage.from("trainer-certificates").remove([path]); throw error; }
      const cert: Cert = { id: data.id, ...c, status: "Pending review" };
      setExtra((x) => ({ ...x, trainer: { ...x.trainer, certs: [...x.trainer.certs, cert] } }));
      setC({ name: "", credentialId: "", expires: "" }); setFile(null);
      const picker = document.getElementById("trainer-cert-file") as HTMLInputElement | null;
      if (picker) picker.value = "";
      await reload(); toast.success("Certification and document submitted for review");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Certification submission failed"); }
    finally { setBusy(false); }
  };
  return <div>
    <p className="mb-2 font-semibold">Certifications</p>
    <div className="grid gap-2 sm:grid-cols-4">
      <input className="field sm:col-span-2" placeholder="e.g. NASM-CPT" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
      <input className="field" placeholder="Credential ID" value={c.credentialId} onChange={(e) => setC({ ...c, credentialId: e.target.value })} />
      <input type="date" className="field" value={c.expires} onChange={(e) => setC({ ...c, expires: e.target.value })} />
    </div>
    <label className="mt-2 block text-sm">Certification document (PDF or image, max 10 MB)
      <input id="trainer-cert-file" className="field mt-1 block w-full" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
    </label>
    <button className="btn btn-ghost mt-2" disabled={!c.name.trim() || !file || busy} onClick={add}>{busy ? "Submitting…" : "+ Submit certification"}</button>
    <ul className="mt-2 space-y-1 text-sm">{records.map((x) => <li key={x.id} className="flex justify-between rounded-lg bg-secondary px-3 py-2"><span>{x.name} · {x.credential_id}</span><span className={x.status === "verified" ? "text-success" : "text-warning"}>{x.status}</span></li>)}</ul>
  </div>;
}

export type YouthStatus = "none" | "pending" | "approved" | "rejected";

export function useYouthStatus() {
  const { s } = useStore();
  const [st, setSt] = useState<YouthStatus>("none");
  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setSt("none");
    const { data } = await supabase.from("youth_consents").select("status").eq("user_id", u.user.id).maybeSingle();
    setSt((data?.status as YouthStatus) ?? "none");
  };
  useEffect(() => { void load(); }, [s.signedIn]);
  return { status: st, reload: load };
}

export function YouthConsent() {
  const { status, reload } = useYouthStatus();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", age: "", guardian: "", email: "", signature: "", agreed: false });
  const submit = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sign in first."); return; }
    const age = +f.age;
    if (age < 8 || age > 17) { toast.error("Youth contributors must be 8–17."); return; }
    const { error } = await supabase.from("youth_consents").insert({ user_id: u.user.id, contributor_name: f.name, contributor_age: age, guardian_name: f.guardian, guardian_email: f.email, guardian_signature: f.signature, release_agreed: f.agreed });
    if (error) { toast.error("Couldn't send — try again."); return; }
    toast.success("Sent to the Tryumph team for review"); setOpen(false); reload();
  };
  const ok = f.name && f.age && f.guardian && /.+@.+\..+/.test(f.email) && f.signature.trim().toLowerCase() === f.guardian.trim().toLowerCase() && f.agreed;
  return (
    <div className="rounded-xl bg-secondary p-4 text-sm">
      <p className="font-semibold">Youth Ambassador (under 18)</p>
      <p className="mt-1 text-muted-foreground">Teen athletes can share family & youth drills without adult certifications, once a parent or guardian gives consent and the Tryumph team approves. Youth Ambassadors never run private 1-on-1s.</p>
      {status === "pending" && <p className="mt-2 text-warning">Consent received — waiting for Tryumph review.</p>}
      {status === "approved" && <p className="mt-2 text-success">Approved — you're a Youth Ambassador.</p>}
      {status === "rejected" && <p className="mt-2 text-destructive">Not approved. Email the team if you have questions.</p>}
      {status === "none" && !open && <button className="btn btn-ghost mt-2" onClick={() => setOpen(true)}>Apply with parent/guardian consent</button>}
      {status === "none" && open && (
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="field sm:col-span-2" placeholder="Contributor's name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="field" type="number" placeholder="Age" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} />
            <input className="field sm:col-span-2" placeholder="Parent/guardian full name" value={f.guardian} onChange={(e) => setF({ ...f, guardian: e.target.value })} />
            <input className="field" type="email" placeholder="Guardian email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
          <label className="flex gap-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={f.agreed} onChange={(e) => setF({ ...f, agreed: e.target.checked })} /><span>As parent/legal guardian, I consent to this minor contributing to Tryumph and grant the content release in <a href="/terms#youth" target="_blank" className="text-primary underline">Section 3 of the Terms</a>.</span></label>
          <input className="field" placeholder="Guardian signature — type full name" value={f.signature} onChange={(e) => setF({ ...f, signature: e.target.value })} />
          <button className="btn btn-primary w-full" disabled={!ok} onClick={submit}>Submit for review</button>
        </div>
      )}
    </div>
  );
}
