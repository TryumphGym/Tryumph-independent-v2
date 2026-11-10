-- Live Supabase security-hardening follow-up (November 10, 2026).
-- Two public catalog views contain only public, RLS-eligible rows and can use
-- the caller's privileges rather than the view owner's elevated privileges.
-- Do not change discoverable_programs here: its approved-edition predicate
-- checks program_editions, which correctly has no anonymous SELECT grant.
-- Giving anon SELECT on program_editions would disclose private program content.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER VIEW public.public_workout_catalog SET (security_invoker = true);
ALTER VIEW public.discoverable_lives SET (security_invoker = true);
DO $verify$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='public_workout_catalog'
   AND c.reloptions @> ARRAY['security_invoker=true']::text[]
 ) OR NOT EXISTS (
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='discoverable_lives'
   AND c.reloptions @> ARRAY['security_invoker=true']::text[]
 ) THEN
   RAISE EXCEPTION 'Public catalog invoker security verification failed';
 END IF;
END $verify$;
COMMIT;
