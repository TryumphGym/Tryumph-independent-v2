-- Restrictive policies also constrain an older permissive policy that may exist in an upgraded project.
DROP POLICY IF EXISTS certificate_read_guard ON storage.objects;
CREATE POLICY certificate_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id<>'trainer-certificates' OR (auth.uid() IS NOT NULL AND ((storage.foldername(name))[1]=auth.uid()::text OR has_role(auth.uid(),'admin'))));
DROP POLICY IF EXISTS certificate_insert_guard ON storage.objects;
CREATE POLICY certificate_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id<>'trainer-certificates' OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1]=auth.uid()::text));
DROP POLICY IF EXISTS certificate_update_guard ON storage.objects;
CREATE POLICY certificate_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'trainer-certificates') WITH CHECK(bucket_id<>'trainer-certificates');
DROP POLICY IF EXISTS certificate_delete_guard ON storage.objects;
CREATE POLICY certificate_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated
 USING(bucket_id<>'trainer-certificates' OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM certifications WHERE document_path=storage.objects.name)));
DROP POLICY IF EXISTS credential_read_guard ON certifications;
CREATE POLICY credential_read_guard ON certifications AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(user_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS credential_review_guard ON certifications;
CREATE POLICY credential_review_guard ON certifications AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(has_role(auth.uid(),'admin') AND user_id<>auth.uid()) WITH CHECK(has_role(auth.uid(),'admin') AND user_id<>auth.uid());
DROP POLICY IF EXISTS credential_delete_guard ON certifications;
CREATE POLICY credential_delete_guard ON certifications AS RESTRICTIVE FOR DELETE TO authenticated USING(false);
DROP POLICY IF EXISTS video_read_guard ON trainer_videos;
CREATE POLICY video_read_guard ON trainer_videos AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(review_status='approved' OR user_id=auth.uid() OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS profile_read_guard ON profiles;
CREATE POLICY profile_read_guard ON profiles AS RESTRICTIVE FOR SELECT TO authenticated
 USING(id=auth.uid() OR has_role(auth.uid(),'admin'));
REVOKE INSERT,UPDATE,DELETE ON user_roles,trainer_earnings,trainer_accounts,checkout_payment_state,
 live_room_access,private_session_access,private_booking_holds,wallet_token_lots,wallet_token_units,wallet_redemptions,
 refund_jobs,payment_disputes,ad_settlement_events,water_break_impressions,live_recordings,video_uploads,
 room_shutdown_jobs,recording_start_locks FROM anon,authenticated;
CREATE OR REPLACE FUNCTION canonical_class_trainer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN SELECT name INTO NEW.trainer_name FROM profiles WHERE id=NEW.trainer_id;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS canonical_class_trainer ON live_sessions;
CREATE TRIGGER canonical_class_trainer BEFORE INSERT OR UPDATE ON live_sessions FOR EACH ROW EXECUTE FUNCTION canonical_class_trainer();
