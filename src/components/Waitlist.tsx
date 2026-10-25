import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { referralSources } from "@/lib/waitlist";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"parent" | "coach">("parent");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [heardFrom, setHeardFrom] = useState("");
  const [liveInterest, setLiveInterest] = useState("");
  const [notifyCoaches, setNotifyCoaches] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { toast.error("Please enter a valid email"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("waitlist_entries").insert({ email: clean, role, heard_from: heardFrom || null, live_class_interest: liveInterest || null, notify_new_coaches: notifyCoaches });
      if (error?.code === "23505") { toast.info("This email is already on the waitlist. You're all set!"); setDone(true); return; }
      if (error) { toast.error("Couldn't save — please try again"); return; }
      setDone(true);
    } catch {
      toast.error("Couldn't save — please try again");
    } finally {
      setBusy(false);
    }
  };

  if (done) return (
    <section className="card p-6 text-center">
      <p className="text-xl font-bold">You're on the list! 🎉</p>
      <p className="mt-1 text-sm text-muted-foreground">We'll email you the moment early access opens.</p>
    </section>
  );

  return (
    <section className="grid gap-6 border-y border-border py-6 md:grid-cols-2 md:gap-8">
      <div>
        <p className="eyebrow">Early access</p>
        <h2 className="mt-1 text-2xl font-bold">Join the founding families</h2>
        <p className="mt-1 text-sm text-muted-foreground">Be first in line for live classes and founding-member perks.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["parent", "coach"] as const).map((r) => (
            <Button key={r} type="button" disabled={busy} aria-pressed={role === r} onClick={() => setRole(r)} variant={role === r ? "default" : "outline"}>
              {r === "parent" ? "Parent / Family" : "Coach / Instructor"}
            </Button>
          ))}
        </div>
      </div>
      <form onSubmit={submit} className="min-w-0 space-y-4">
        <div className="space-y-2">
          <label htmlFor="waitlist-email" className="text-sm font-medium">Email</label>
          <Input id="waitlist-email" type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
        </div>
        <div className="space-y-2">
          <label htmlFor="waitlist-source" className="block text-sm font-medium">Where did you hear about us? <span className="font-normal text-muted-foreground">(optional)</span></label>
          <select id="waitlist-source" disabled={busy} value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Select an option</option>
            {referralSources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="waitlist-live" className="block text-sm font-medium">Would you be interested in joining a live workout class for $5 when Tryumph launches? <span className="font-normal text-muted-foreground">(optional)</span></label>
          <select id="waitlist-live" disabled={busy} value={liveInterest} onChange={(e) => setLiveInterest(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Select an option</option>
            <option value="yes">Yes, I'm interested!</option>
            <option value="maybe">Maybe</option>
            <option value="no">Not right now</option>
          </select>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox id="waitlist-coaches" disabled={busy} checked={notifyCoaches} onCheckedChange={(checked) => setNotifyCoaches(checked === true)} className="mt-0.5" />
          <label htmlFor="waitlist-coaches" className="cursor-pointer text-sm">Email me when a new coach joins Tryumph.</label>
        </div>
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "Joining…" : "Join waitlist"}</Button>
      </form>
    </section>
  );
}
