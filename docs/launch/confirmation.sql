-- READ ONLY after the entire staging transaction succeeds.
SELECT version,applied_at FROM public.launch_schema_versions WHERE version='0054_launch_completion';
SELECT name,to_regclass('public.'||name) IS NOT NULL AS present
FROM unnest(ARRAY['content_reports','audience_announcements','moderation_actions','moderation_appeals','account_restrictions','message_controls','account_notifications','notification_preferences','account_activity_days','private_booking_payments','private_balance_operations','private_reschedule_requests','private_room_shutdown_jobs']) name;
SELECT NOT has_function_privilege('authenticated','public.consume_attended_live_token(uuid,uuid)','EXECUTE') AS member_cannot_spend_from_browser,
 NOT has_function_privilege('authenticated','public.apply_private_balance(text,text,integer,integer)','EXECUTE') AS member_cannot_settle_balance,
 NOT has_table_privilege('authenticated','public.private_payment_methods','SELECT') AS saved_payment_ids_private,
 NOT has_table_privilege('authenticated','public.moderation_actions','INSERT') AS audit_log_not_client_writable;
SELECT tablename,policyname,permissive,cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('messages','content_reports','audience_announcements','account_notifications','private_session_access') ORDER BY tablename,policyname;
SELECT payment_version,status,count(*) FROM public.private_session_access GROUP BY payment_version,status ORDER BY payment_version,status;
SELECT count(*) AS pending_refunds FROM public.refund_jobs WHERE completed_at IS NULL;
SELECT count(*) AS ambiguous_balance_operations FROM public.private_balance_operations WHERE intent_id IS NULL AND created_at<now()-interval '23 hours';
-- SQL Editor owner access is not an RLS test. Complete the account/browser scripts in FOUNDER_HANDOFF.md.
