-- STAGING ONLY. Run after 01_stage_apply.sql; no provider workers or app traffic.
-- Validates the additive reviewer FK. No records are repaired, removed or charged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
ALTER TABLE public.trainer_videos VALIDATE CONSTRAINT trainer_videos_reviewed_by_fkey;
DO $validation$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['account_activity_days','account_notifications','account_restrictions','audience_announcements',
 'contact_delivery_requests','content_reports','launch_schema_versions','legacy_friendship_grants','message_controls','moderation_actions',
 'moderation_appeals','notification_preferences','private_balance_operations','private_booking_payments','private_payment_methods',
 'private_reschedule_requests','private_room_shutdown_jobs','trainer_credential_requirements'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid=to_regclass('public.'||t) AND c.relrowsecurity) THEN
   RAISE EXCEPTION 'Missing table/RLS: %',t;
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.messages'::regclass AND polname='launch_message_permission' AND NOT polpermissive) THEN RAISE EXCEPTION 'Missing restrictive messaging guard'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.messages'::regclass AND polname='Trainer inquiries may be sent without friendship') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.messages'::regclass AND polname='Trainer inquiries may be sent without friendship' AND pg_catalog.pg_get_expr(polwithcheck,polrelid)='can_send_message(sender_id, recipient_id)')
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='public.messages'::regclass AND polname='launch_trainer_inquiries') THEN RAISE EXCEPTION 'Manual inquiry policy not reconciled'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') AND
 (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) THEN RAISE EXCEPTION 'Client TRUNCATE is still possible'; END IF;
 IF has_function_privilege('authenticated','public.consume_attended_live_token(uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.apply_private_deposit(text,uuid,uuid,integer,integer,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.apply_private_balance(text,text,integer,integer)','EXECUTE')
 THEN RAISE EXCEPTION 'Client payment/attendance RPC privileges are unsafe'; END IF;
 IF NOT has_function_privilege('anon','public.has_role(uuid,public.app_role)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous approved-content policy dependency unavailable'; END IF;
END $validation$;
SELECT 'staging_catalog_validation_passed' AS result;
COMMIT;
-- Catalog validation is NOT two-account RLS acceptance, a restore rehearsal,
-- provider verification, or authorization for production SQL/deployment.
