// Compatibility adapter for old imports; OAuth is handled by the independent Supabase project.
import { supabase } from "../supabase/client";
type OAuthProvider = "google" | "apple" | "facebook" | "github" | "discord";
type SignInOptions = { redirect_uri?: string; extraParams?: Record<string, string> };
export const lovable = {
  auth: {
    signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) =>
      supabase.auth.signInWithOAuth({ provider, options: { redirectTo: opts?.redirect_uri, queryParams: opts?.extraParams } }),
  },
};
