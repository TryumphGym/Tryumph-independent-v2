-- READ ONLY. Run on a disposable staging clone after reconciling through 0073.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name,now() AS inspected_at;
SELECT p.polname,pg_get_expr(p.polqual,p.polrelid) AS using_expression,pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression,p.polcmd,p.polpermissive,p.polroles::text
FROM pg_policy p WHERE p.polrelid='public.messages'::regclass ORDER BY p.polname;
-- Compare the above byte-for-byte with the pre-upgrade inspection/manual trainer inquiry policy.
SELECT n.nspname,c.relname,c.relrowsecurity,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('creator_partnerships','creator_follow_events','creator_playbacks','creator_perks','school_tutorials','subscriber_live_access','program_subscription_enrollments','program_download_progress','discovery_demand','discovery_privacy','spotlight_packages','spotlight_campaigns','creator_comment_holds','workout_comments','live_payment_links') ORDER BY c.relname;
SELECT p.oid::regprocedure AS routine,p.prosecdef,p.proconfig,p.proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('trainer_is_eligible','reserve_live_class','consume_attended_live_token','live_subscription_deadline','program_access','creator_program_access','program_media_access','program_asset_access','record_discovery_demand','creator_demand_insights','approve_program_terms','save_workout_comment') ORDER BY p.oid::regprocedure::text;
SELECT enabled,commission_bps,terms_version,approved_at FROM program_commerce;
SELECT enabled,commission_bps,min_price_cents,max_price_cents,recommended_price_cents FROM creator_commerce;
SELECT days,price_cents,available,inventory FROM spotlight_packages ORDER BY days;
SELECT audience,published,count(*) FROM school_tutorials GROUP BY audience,published;
-- Historical order distribution must remain unchanged by 0066; new orders require 1000 bps.
SELECT commission_bps,count(*),sum(price_cents),sum(fee_cents),sum(refunded_cents) FROM program_orders GROUP BY commission_bps;
-- These classes need owner review/refund decisions before any staged activation. No rows are changed here.
SELECT l.id,l.trainer_id,l.starts_at,l.status,(SELECT count(*) FROM trainer_videos v WHERE v.user_id=l.trainer_id AND v.review_status='approved') AS approved_videos,(SELECT count(*) FROM live_room_access a WHERE a.session_id=l.id AND a.status='paid') AS paid_bookings
FROM live_sessions l WHERE l.status IN ('scheduled','live') AND NOT trainer_is_eligible(l.trainer_id,true);
SELECT 'inspection_complete' AS status;
COMMIT;
