import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { AudienceAnnouncements } from "@/components/AudienceAnnouncements";

type Cert = { name: string; expires: string; status: string };
type Session = { id: string; title: string; starts_at: string; status: string };
export function AccountNoticeCenter({ trainer = false }: { trainer?: boolean }) {
  const { s } = useStore();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [classes, setClasses] = useState<Session[]>([]);
  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || !active) return;
      if (trainer) {
        const result = await supabase.from("certifications").select("name,expires,status").eq("user_id", data.user.id);
        if (active && !result.error) setCerts(result.data ?? []);
      } else if (s.reservations.length) {
        const result = await supabase.from("live_sessions")
          .select("id,title,starts_at,status").in("id", s.reservations)
          .gte("starts_at", new Date(Date.now() - 86400000).toISOString())
          .order("starts_at").limit(20);
        if (active && !result.error) setClasses(result.data ?? []);
      }
    });
    return () => { active = false; };
  }, [trainer, s.reservations]);
  const now = Date.now();
  const certWarnings = certs.flatMap(cert => {
    if (!cert.expires) return [];
    const expiry = new Date(cert.expires).getTime();
    if (!Number.isFinite(expiry)) return [];
    const days = Math.ceil((expiry - now) / 86400000);
    if (days > 60) return [];
    return [{ key: cert.name + cert.expires, text: days < 0
      ? `${cert.name} has expired. Please submit an updated certification.`
      : `${cert.name} expires in ${days} day(s). Please renew before expiration.` }];
  });
  return <section className="card mb-6 space-y-3 p-5" aria-label="Your notification center">
    <h2 className="text-xl font-bold">Notifications & announcements</h2>
    <p className="text-sm text-muted-foreground">{trainer
      ? "Certification reminders and trainer notices from Tryumph Gym."
      : "Company news and updates about your reserved classes."}</p>
    {trainer && certWarnings.map(n => <p key={n.key} role="status" className="rounded-lg border border-amber-500/40 p-3 text-sm">{n.text}</p>)}
    {!trainer && classes.map(item => <div key={item.id} className="rounded-lg border p-3 text-sm">
      <span className="font-semibold">{item.title}</span>
      <p className="text-muted-foreground">{item.status === "cancelled" ? "Cancelled" : item.status === "scheduled" ? "Reserved class" : item.status} · {new Date(item.starts_at).toLocaleString()}</p>
    </div>)}
    <AudienceAnnouncements />
    <p className="text-xs text-muted-foreground">Class-change history and friend activity notifications will appear here when those event feeds are enabled.</p>
  </section>;
}
