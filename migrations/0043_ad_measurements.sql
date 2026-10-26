-- Measurements are authenticated, deduplicated, and NEVER themselves create payable earnings.
ALTER TABLE water_break_impressions ADD COLUMN IF NOT EXISTS viewer_id uuid REFERENCES auth.users(id);
ALTER TABLE water_break_impressions ADD COLUMN IF NOT EXISTS impression_day date NOT NULL DEFAULT current_date;
CREATE UNIQUE INDEX IF NOT EXISTS measured_break_per_day ON water_break_impressions(viewer_id,video_id,break_second,impression_day);
DROP FUNCTION IF EXISTS public.record_water_break_impression(uuid,uuid,integer,uuid);
CREATE OR REPLACE FUNCTION public.record_water_break_impression(p_campaign_id uuid,p_video_id uuid,p_break_second integer,p_playback_id uuid,p_viewer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM water_break_campaigns WHERE id=p_campaign_id AND active
 AND (start_at IS NULL OR start_at<=now()) AND (end_at IS NULL OR end_at>=now())) THEN RAISE EXCEPTION 'Inactive campaign'; END IF;
 IF NOT EXISTS(SELECT 1 FROM trainer_videos WHERE id=p_video_id AND review_status='approved' AND p_break_second=ANY(breaks))
 THEN RAISE EXCEPTION 'Unapproved workout or break'; END IF;
 INSERT INTO water_break_impressions(campaign_id,video_id,break_second,playback_id,viewer_id)
 VALUES(p_campaign_id,p_video_id,p_break_second,p_playback_id,p_viewer_id) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION record_water_break_impression(uuid,uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION record_water_break_impression(uuid,uuid,integer,uuid,uuid) TO service_role;
