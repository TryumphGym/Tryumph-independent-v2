import { supabase } from "@/integrations/supabase/client";
/** Presentation routing never writes the persisted role or derives privileges from local state. */
export async function authenticatedExperience() {
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user)
    throw new Error("Sign in to verify your account.");
  const profile = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.data.user.id)
    .single();
  if (profile.error)
    throw new Error(
      "Signed in, but could not verify your account role. Please retry.",
    );
  return {
    userId: auth.data.user.id,
    landing:
      profile.data.role === "trainer" ? ("/studio" as const) : ("/" as const),
  };
}
