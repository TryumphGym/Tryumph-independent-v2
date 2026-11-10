import { type ReactNode } from "react";
import { BarChart3, ClipboardCheck, Cog, Megaphone, ShieldAlert, Users } from "lucide-react";
export const HQ_SECTIONS = [
  { id:"overview", label:"Overview", icon:BarChart3, description:"Business health and what needs your attention." },
  { id:"reviews", label:"Approvals", icon:ClipboardCheck, description:"Trainer certifications, video approvals and other reviews." },
  { id:"operations", label:"Payments & operations", icon:Cog, description:"Payouts, refunds and operational work queues." },
  { id:"creators", label:"Trainers & content", icon:Users, description:"Creator, program and resource administration." },
  { id:"safety", label:"Safety & moderation", icon:ShieldAlert, description:"Reports, appeals and community protection." },
  { id:"growth", label:"Marketing & growth", icon:Megaphone, description:"Waitlist, announcements, sponsors and Spotlight drafts." },
] as const;
export type HQSection = (typeof HQ_SECTIONS)[number]["id"];
export function HQNavigation({active,onSelect,children}:{active:HQSection;onSelect:(section:HQSection)=>void;children:ReactNode}) {
  const current=HQ_SECTIONS.find(x=>x.id===active)!;
  return <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside aria-label="Tryumph HQ navigation" className="hidden lg:block"><nav className="sticky top-20 space-y-1 rounded-2xl border border-border bg-card p-3" aria-label="HQ sections">
      <div className="mb-3 border-b border-border px-3 pb-3"><p className="eyebrow">Owner workspace</p><h2 className="mt-1 text-xl font-bold">Tryumph HQ</h2></div>
      {HQ_SECTIONS.map(({id,label,icon:Icon})=><button type="button" key={id} aria-current={active===id?"page":undefined} onClick={()=>onSelect(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${active===id?"bg-primary/10 font-semibold text-primary":"hover:bg-secondary"}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/>{label}</button>)}
    </nav></aside>
    <div className="min-w-0 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5"><p className="eyebrow">Founder operations</p><h1 className="mt-1 text-2xl font-bold">{current.label}</h1><p className="mt-2 text-sm text-muted-foreground">{current.description}</p></div>
      <div className="lg:hidden"><label htmlFor="hq-mobile-section" className="mb-2 block text-sm font-semibold">HQ section</label><select id="hq-mobile-section" className="field w-full" value={active} onChange={e=>onSelect(e.target.value as HQSection)}>{HQ_SECTIONS.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
      {children}
    </div>
  </div>;
}
