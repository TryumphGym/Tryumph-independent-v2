import { useState, type ReactNode } from "react";
import { BarChart3, BookOpen, CalendarDays, CircleDollarSign, Clapperboard, GraduationCap, LayoutDashboard, Megaphone, MessageCircle, Radio, Search, Settings2, ShieldCheck, Sparkles, Upload, Users, type LucideIcon } from "lucide-react";

export const STUDIO_SECTIONS = ["Dashboard", "Analytics", "Content Library", "Live Studio", "Programs", "Trybe & Community", "Messages & Partnerships", "Bookings & Clients", "Earnings & Payouts", "Creator Perks", "Tryumph School", "Settings", "Marketing & Spotlight"] as const;
export type StudioSection = (typeof STUDIO_SECTIONS)[number];
type Item = { name: StudioSection; icon: LucideIcon };
const groups: { title: string; items: Item[] }[] = [
  { title: "Overview", items: [{ name: "Dashboard", icon: LayoutDashboard }, { name: "Analytics", icon: BarChart3 }] },
  { title: "Create", items: [{ name: "Content Library", icon: Clapperboard }, { name: "Live Studio", icon: Radio }, { name: "Programs", icon: BookOpen }] },
  { title: "Your audience", items: [{ name: "Trybe & Community", icon: Users }, { name: "Messages & Partnerships", icon: MessageCircle }, { name: "Bookings & Clients", icon: CalendarDays }] },
  { title: "Business", items: [{ name: "Earnings & Payouts", icon: CircleDollarSign }, { name: "Marketing & Spotlight", icon: Megaphone }] },
  { title: "Resources", items: [{ name: "Creator Perks", icon: Sparkles }, { name: "Tryumph School", icon: GraduationCap }, { name: "Settings", icon: Settings2 }] },
];
const descriptions: Record<StudioSection, string> = {
  Dashboard: "Your updates and next steps in one place.",
  Analytics: "Audience, workout and program performance.",
  "Content Library": "Upload, publish and manage your workouts.",
  "Live Studio": "Schedule classes and manage recordings.",
  Programs: "Build programs and manage member offers.",
  "Trybe & Community": "Connect with your community and manage your store.",
  "Messages & Partnerships": "Member conversations and professional inquiries.",
  "Bookings & Clients": "Calendar, availability and private sessions.",
  "Earnings & Payouts": "Verified earnings and payout setup.",
  "Creator Perks": "Benefits available to eligible trainers.",
  "Tryumph School": "Guides for building your business.",
  Settings: "Profile, specialties and credentials.",
  "Marketing & Spotlight": "Promotion tools and Spotlight drafts.",
};
export function StudioNavigation({ active, verified, onSelect, children }: { active: StudioSection; verified: boolean; onSelect: (section: StudioSection) => void; children: ReactNode }) {
  const [search, setSearch] = useState("");
  const shown = groups.map(group => ({ ...group, items: group.items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase())) })).filter(group => group.items.length);
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="hidden lg:block" aria-label="Trainer Studio navigation"><div className="sticky top-6 max-h-[calc(100vh-3rem)] space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-4">
      <div className="border-b border-border pb-3"><p className="text-xs font-bold uppercase tracking-wider text-primary">Tryumph</p><h2 className="mt-1 font-display text-lg font-bold">Trainer Studio</h2><p className="mt-1 text-xs text-muted-foreground">Your creator workspace</p></div>
      <label className="relative block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><span className="sr-only">Find a Studio section</span><input className="field w-full pl-9 text-sm" placeholder="Find a tool…" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <nav aria-label="Studio sections" className="space-y-4">
        {!shown.length && <p className="text-sm text-muted-foreground">No matching section.</p>}
        {shown.map(group => <div key={group.title}><p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>{group.items.map(({name,icon:Icon}) => <button key={name} type="button" aria-current={active === name ? "page" : undefined} onClick={() => onSelect(name)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active === name ? "bg-primary/10 font-semibold text-primary" : "hover:bg-secondary"}`}><Icon aria-hidden="true" className="h-4 w-4 shrink-0"/><span>{name}</span></button>)}</div>)}
      </nav>
    </div></aside>
    <div className="min-w-0 space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Trainer Studio</p><h1 className="mt-1 font-display text-2xl font-bold">{active}</h1><p className="mt-2 text-sm text-muted-foreground">{descriptions[active]}</p><p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true"/>{verified ? "Verified trainer" : "Certification verification needed"}</p></div>
      <button type="button" className="btn btn-primary inline-flex items-center gap-2" onClick={() => onSelect("Content Library")}><Upload className="h-4 w-4" aria-hidden="true"/>Upload workout</button></div></div>
      <div className="lg:hidden"><label className="mb-2 block text-sm font-medium" htmlFor="studio-section">Go to section</label><select id="studio-section" className="field w-full" value={active} onChange={e => onSelect(e.target.value as StudioSection)}>{groups.map(group => <optgroup key={group.title} label={group.title}>{group.items.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</optgroup>)}</select></div>
      {children}
    </div>
  </div>;
}
export function StudioSubnav({options,active,onSelect}: {options: ReadonlyArray<{id:string;label:string}>;active:string;onSelect:(id:string)=>void}) {
  return <nav className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Section tools">{options.map(o => <button key={o.id} type="button" aria-current={o.id===active ? "page" : undefined} onClick={() => onSelect(o.id)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${o.id===active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}>{o.label}</button>)}</nav>;
}
