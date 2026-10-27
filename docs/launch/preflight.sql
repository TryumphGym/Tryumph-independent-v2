-- READ ONLY. Run in staging first. Missing required_historical tables or incompatible
-- definitions are a STOP. Missing later launch tables selects the full upgrade path.
SELECT name,name NOT IN ('checkout_payment_state','wallet_token_units','private_session_access','friend_requests') AS required_historical,
 to_regclass('public.'||name) IS NOT NULL AS present
FROM unnest(ARRAY['profiles','user_roles','messages','friendships','certifications','trainer_videos','trainer_earnings','trainer_accounts','trainer_busy','live_sessions','posts','post_comments','post_likes','checkout_payment_state','wallet_token_units','private_session_access','friend_requests']) name;
SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('profiles','messages','certifications','trainer_videos','private_session_access','content_reports','audience_announcements','friend_requests','friendships') ORDER BY table_name,ordinal_position;
-- Includes any manually applied trainer inquiry policy. The new restrictive guard
-- intentionally constrains it while preserving existing sender/recipient reads.
SELECT schemaname,tablename,policyname,permissive,cmd,roles,qual,with_check
FROM pg_policies WHERE (schemaname='public' AND tablename IN ('messages','profiles','posts','post_comments','certifications','trainer_videos','live_room_access','private_session_access','friend_requests','friendships')) OR schemaname='storage'
ORDER BY schemaname,tablename,policyname;
SELECT proname,prosecdef,proconfig,proacl FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace
WHERE n.nspname='public' AND proname IN ('trainer_is_eligible','has_role','can_send_message','apply_paid_private_booking','apply_checkout_refund');
SELECT user_id,role FROM public.user_roles WHERE role IN ('admin','moderator');
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets
WHERE id IN ('trainer-certificates','videos','avatars','trainer-store-images');
SELECT tgname,pg_get_triggerdef(oid) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.profiles'::regclass,'public.certifications'::regclass,'public.trainer_videos'::regclass,'public.live_sessions'::regclass);
