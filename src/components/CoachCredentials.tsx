import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { credentialLabel, hasVerifiedCpr, isCpr, type CredentialRecord } from "@/lib/cpr";

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
  const { s } = useStore();
  const [c, setC] = useState({ name: "", issuingOrganization: "", credentialId: "", expires: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [records, setRecords] = useState<CredentialRecord[]>([]);
  const reload = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setRecords([]); return; }
    const { data, error } = await supabase.from("certifications")
      .select("id,name,credential_id,issuing_organization,expires,status,document_path,verified_at,verified_by")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false });
    if (error) toast.error("Could not load certifications");
    else setRecords((data ?? []) as CredentialRecord[]);
  };
  useEffect(() => { void reload(); }, [s.signedIn]);
  const beginRenewal = (r: CredentialRecord) => {
    setRenewing(r.id ?? null);
    setC({ name: r.name, issuingOrganization: r.issuing_organization ?? "", credentialId: r.credential_id ?? "", expires: "" });
    setFile(null);
    document.getElementById("credential-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const submit = async () => {
    if (!c.name.trim() || !c.expires || !file || busy) return;
    if (c.expires < new Date().toISOString().slice(0, 10)) { toast.error("The credential expiration date must be in the future."); return; }
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
      // Renewals are new pending submissions. Never overwrite an admin-verified credential or its audit trail.
      const { error } = await supabase.from("certifications").insert({ user_id: auth.user.id, trainer_name: s.name,
        name: c.name.trim(), issuing_organization: c.issuingOrganization.trim(), credential_id: c.credentialId.trim(),
        expires: c.expires, document_path: path, status: "pending" });
      if (error) { await supabase.storage.from("trainer-certificates").remove([path]); throw error; }
      setC({ name: "", issuingOrganization: "", credentialId: "", expires: "" });
      setFile(null); setRenewing(null);
      const picker = document.getElementById("trainer-cert-file") as HTMLInputElement | null;
      if (picker) picker.value = "";
      await reload(); toast.success("Credential submitted for admin review");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Credential submission failed"); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <div>
      <p className="font-semibold">My credentials</p>
      <p className="mt-1 text-sm text-muted-foreground">Current, admin-verified CPR certification is required for Verified Pro status. Expiring credentials are flagged within 30 days.</p>
      <p className={`mt-2 text-sm font-medium ${hasVerifiedCpr(records) ? "text-success" : "text-warning"}`}>
        {hasVerifiedCpr(records) ? "CPR requirement met" : "CPR verification required — upload a current CPR certificate below"}
      </p>
    </div>
    <ul className="space-y-3 text-sm">{records.map((r) => <li key={r.id} className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="font-semibold">{r.name}{isCpr(r.name) ? " · CPR" : ""}</p>
          <p className="text-muted-foreground">{r.issuing_organization || "Issuer not provided"}{r.credential_id ? ` · ID: ${r.credential_id}` : ""}</p>
          <p className="text-muted-foreground">{r.expires ? `Expires ${r.expires}` : "Expiration date not provided"}</p>
        </div>
        <span className={credentialLabel(r) === "Verified" ? "text-success" : "text-warning"}>{credentialLabel(r)}</span>
      </div>
      <button type="button" className="btn btn-ghost mt-2" onClick={() => beginRenewal(r)}>Renew / Update credential</button>
    </li>)}</ul>
    <div id="credential-form" className="space-y-2 rounded-lg bg-secondary p-3">
      <p className="font-semibold">{renewing ? "Submit updated credential for review" : "Add new credential"}</p>
      <p className="text-xs text-muted-foreground">Updating creates a new pending review. Your existing verified record is preserved.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="field" placeholder="Credential name (e.g. CPR/AED)" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        <input className="field" placeholder="Issuing organization" value={c.issuingOrganization} onChange={(e) => setC({ ...c, issuingOrganization: e.target.value })} />
        <input className="field" placeholder="Credential ID" value={c.credentialId} onChange={(e) => setC({ ...c, credentialId: e.target.value })} />
        <label className="text-sm">Expiration date<input type="date" className="field mt-1 w-full" value={c.expires} onChange={(e) => setC({ ...c, expires: e.target.value })} /></label>
      </div>
      <label className="block text-sm">Credential document (PDF or image, max 10 MB)
        <input id="trainer-cert-file" className="field mt-1 block w-full" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={!c.name.trim() || !c.expires || !file || busy} onClick={submit}>{busy ? "Submitting…" : renewing ? "Submit renewal for review" : "Submit credential"}</button>
        {renewing && <button className="btn btn-ghost" onClick={() => { setRenewing(null); setC({ name: "", issuingOrganization: "", credentialId: "", expires: "" }); setFile(null); }}>Cancel renewal</button>}
      </div>
    </div>
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
