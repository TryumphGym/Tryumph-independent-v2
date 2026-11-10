-- READ ONLY. Run after 0060–0064 on staging; metadata/aggregate counts only.
BEGIN READ ONLY;
SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN('creator_commerce','creator_offers','creator_orders','creator_receipts','creator_disputes','creator_transfer_operations','creator_refund_jobs','creator_video_access','program_assets','program_edition_assets','workout_feedback','workout_feedback_totals','workout_feedback_blocks','post_photos','community_ad_config','community_ad_sessions','community_ad_seen','community_ad_receipts') ORDER BY c.relname;
SELECT enabled,commission_bps,terms_version,approved_at FROM public.creator_commerce;
SELECT enabled,max_photos,max_bytes FROM public.community_media_config;
SELECT enabled,first_after,spacing FROM public.community_ad_config;
SELECT min_members,agreement_bps FROM public.workout_feedback_config;
SELECT
 NOT has_function_privilege('authenticated','public.record_creator_invoice(uuid,text,text,integer,integer,integer,timestamptz,timestamptz,timestamptz)','EXECUTE') AS recurring_settlement_server_only,
 NOT has_table_privilege('authenticated','public.creator_receipts','INSERT') AS client_receipt_insert_denied,
 NOT has_function_privilege('authenticated','public.review_post_photo(uuid,text,integer,text,text,boolean)','EXECUTE') AS automated_photo_decisions_server_only,
 NOT has_function_privilege('authenticated','public.community_ad_slot(uuid,uuid,uuid[])','EXECUTE') AS ad_spacing_server_only,
 NOT has_table_privilege('anon','public.workout_feedback','SELECT') AS feedback_identities_not_public;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id IN('trainer-certificates','program-demonstrations','program-downloads','community-photo-uploads','community-photos');
SELECT polname,pg_get_expr(polqual,polrelid) AS using_expr,pg_get_expr(polwithcheck,polrelid) AS check_expr FROM pg_policy WHERE polrelid='public.messages'::regclass ORDER BY polname;
SELECT pg_get_functiondef('public.trainer_is_eligible(uuid,boolean)'::regprocedure) AS current_eligibility_definition;
SELECT count(*) AS pending_membership_refunds FROM public.creator_refund_jobs WHERE completed_at IS NULL;
SELECT count(*) AS specialist_holds FROM public.post_photos WHERE status='specialist' AND removed_at IS NULL;
-- Actual JWT/HTTP/provider/realtime tests remain necessary; catalog ACL checks alone are insufficient.
ROLLBACK;
