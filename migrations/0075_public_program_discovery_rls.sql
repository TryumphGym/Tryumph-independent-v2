-- Secure public program discovery with invoker RLS, without exposing paid
-- program_editions documents or weakening enrollment authorization.
-- The only privileged lookup is a stable yes/no check of a published,
-- non-blocked program's independently approved current edition.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE SCHEMA IF NOT EXISTS tryumph_internal;
REVOKE ALL ON SCHEMA tryumph_internal FROM PUBLIC;
GRANT USAGE ON SCHEMA tryumph_internal TO anon,authenticated,service_role;
CREATE FUNCTION tryumph_internal.public_program_edition_approved(p_program_id uuid,p_edition_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $helper$
 SELECT EXISTS(
  SELECT 1 FROM public.program_editions e JOIN public.trainer_programs p ON p.id=e.program_id
  WHERE e.id=p_edition_id AND p.id=p_program_id AND p.current_edition=e.id
    AND e.review_status='approved' AND p.builder_version=2 AND p.published AND NOT p.blocked
 );
$helper$;
REVOKE ALL ON FUNCTION tryumph_internal.public_program_edition_approved(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tryumph_internal.public_program_edition_approved(uuid,uuid) TO anon,authenticated,service_role;
DO $replace$ DECLARE columns text; BEGIN
 SELECT string_agg(CASE WHEN a.attname='discovery_focus_tags' THEN
  'public.discovery_focus(ARRAY(SELECT jsonb_array_elements_text(coalesce(p.summary->''discovery_tags'',''[]''::jsonb))),coalesce(p.summary->>''category'','''')||'' ''||coalesce(p.summary->>''difficulty'','''')||'' ''||coalesce(p.summary->''goals'',''[]''::jsonb)::text) AS discovery_focus_tags'
 ELSE format('p.%I',a.attname) END,',' ORDER BY a.attnum) INTO columns
 FROM pg_attribute a WHERE a.attrelid='public.discoverable_programs'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF columns IS NULL THEN RAISE EXCEPTION 'Program catalog definition missing'; END IF;
 EXECUTE 'CREATE OR REPLACE VIEW public.discoverable_programs WITH (security_barrier=true,security_invoker=true) AS SELECT '||columns||
 ' FROM public.trainer_programs p WHERE p.builder_version=2 AND p.published AND NOT p.blocked AND tryumph_internal.public_program_edition_approved(p.id,p.current_edition) AND coalesce(p.summary->>''category'','''') !~* ''youth|homeschool|nutrition''';
END $replace$;
DO $verify$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid='public.discoverable_programs'::regclass AND c.reloptions @> ARRAY['security_invoker=true']::text[]) THEN RAISE EXCEPTION 'Program catalog view must use invoker security'; END IF;
 IF has_table_privilege('anon','public.program_editions','SELECT') THEN RAISE EXCEPTION 'Private program edition data must remain inaccessible anonymously'; END IF;
END $verify$;
COMMIT;
