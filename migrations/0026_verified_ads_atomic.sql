-- Apply at SQL phase AFTER 0022 and 0023. Revenue is credited only from trusted signed settlements.
CREATE OR REPLACE FUNCTION public.apply_verified_ad_settlement(
 p_network text,p_network_event_id text,p_video_id uuid,p_trainer_id uuid,
 p_break_second integer,p_gross_cents integer,p_fee_cents integer,p_trainer_cents integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_gross_cents < 0 OR p_fee_cents < 0 OR p_fee_cents > p_gross_cents
    OR p_trainer_cents <> floor((p_gross_cents-p_fee_cents)*0.5)::integer THEN
   RAISE EXCEPTION 'Invalid advertising allocation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.trainer_videos WHERE id=p_video_id AND user_id=p_trainer_id
   AND review_status='approved' AND p_break_second=ANY(breaks)) THEN
   RAISE EXCEPTION 'Ineligible workout/break'; END IF;
 INSERT INTO public.ad_settlement_events(network,network_event_id,video_id,trainer_id,
   break_second,gross_cents,fee_cents)
 VALUES(p_network,p_network_event_id,p_video_id,p_trainer_id,p_break_second,p_gross_cents,p_fee_cents)
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO public.trainer_earnings(trainer_slug,source,ref,gross_cents,fee_cents,net_cents,share_pct,payout_cents)
 VALUES(p_trainer_id::text,'ads','ad:'||p_network||':'||p_network_event_id,
   p_gross_cents,p_fee_cents,p_gross_cents-p_fee_cents,50,p_trainer_cents);
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_ad_settlement(text,text,uuid,uuid,integer,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_ad_settlement(text,text,uuid,uuid,integer,integer,integer,integer) TO service_role;
