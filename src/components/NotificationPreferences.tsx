import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const labels = {
  session_updates: "Session reminders and booking updates",
  poll_updates: "New polls in my Trybes",
  creator_updates: "Business and creator activity",
  subscriber_lives: "Subscriber-only live announcements",
  credential_updates: "Trainer certification reminders",
  friend_activity: "Friends' class activity",
  share_live_activity: "Share my class activity with mutual partners",
} as const;
type Preference = keyof typeof labels;
type Preferences = Record<Preference, boolean>;
const defaults: Preferences = {
  session_updates: true, poll_updates: false, creator_updates: true,
  subscriber_lives: false, credential_updates: true,
  friend_activity: false, share_live_activity: false,
};

export function NotificationPreferences({trainer = false}: {trainer?:boolean}) {
  const [userId, setUserId] = useState<string|null>(null);
  const [value, setValue] = useState<Preferences>(defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const {data: auth} = await supabase.auth.getUser();
      if (!active) return;
      const uid = auth.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const {data,error: e} = await supabase.from("notification_preferences")
        .select("session_updates,poll_updates,creator_updates,subscriber_lives,credential_updates,friend_activity,share_live_activity")
        .eq("user_id",uid).maybeSingle();
      if (!active) return;
      if (e) setError("Couldn't load notification preferences.");
      else if (data) setValue({...defaults,...data});
    })();
    return () => { active=false; };
  },[]);
  async function update(key:Preference, checked:boolean) {
    if (!userId || busy) return;
    setBusy(true);
    const next={...value,[key]:checked};
    const {error:e}=await supabase.from("notification_preferences").upsert({user_id:userId,...next});
    if(e) toast.error("Couldn't save notification preferences");
    else {setValue(next);toast.success("Notification preferences saved");}
    setBusy(false);
  }
  return <div className="space-y-3">
    <h3 className="font-semibold">Notification preferences</h3>
    <p className="text-sm text-muted-foreground">Choose which optional updates to receive. Important account and safety notices remain accessible in your notification center.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!userId && !error && <p className="text-sm text-muted-foreground">Loading your settings…</p>}
    <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(labels) as Preference[]).filter(key=>trainer||key!=="credential_updates").map(key=><label key={key} className="flex items-start gap-3 rounded-lg bg-secondary p-3 text-sm"><input type="checkbox" className="mt-1" disabled={!userId||busy} checked={value[key]} onChange={e=>void update(key,e.target.checked)}/><span>{labels[key]}</span></label>)}</div>
  </div>;
}
