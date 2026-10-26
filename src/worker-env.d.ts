declare module "cloudflare:workers" {
  export const env: {
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    BUNNY_STREAM_LIBRARY_ID?: string;
    BUNNY_STREAM_API_KEY?: string;
    [name: string]: unknown;
  };
}
