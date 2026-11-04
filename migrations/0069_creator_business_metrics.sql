BEGIN;
CREATE FUNCTION public.creator_business_metrics(p_start timestamptz,p_end timestamptz) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE result jsonb;BEGIN
 IF auth.uid() IS NULL OR NOT account_can_act(auth.uid(),false) OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='trainer') OR p_start IS NULL OR p_end IS NULL OR p_start>=p_end OR p_end-p_start>interval '366 days' OR p_end>now()+interval '1 day' THEN RAISE EXCEPTION 'Trainer and valid date range required';END IF;
 WITH revenue AS (
 SELECT source,payout_cents-withheld_cents AS earned,CASE WHEN transfer_id IS NOT NULL THEN payout_cents-withheld_cents-transfer_reversed_cents ELSE 0 END AS transferred FROM trainer_earnings WHERE trainer_slug=auth.uid()::text AND created_at>=p_start AND created_at<p_end AND adjustment_for IS NULL
 UNION ALL SELECT 'subscription',CASE WHEN r.refund_pending OR EXISTS(SELECT 1 FROM creator_disputes d WHERE d.order_id=r.id AND d.status IN ('open','lost')) THEN 0 ELSE floor(greatest(r.price_cents-r.refunded_cents-r.fee_cents,0)::numeric*(10000-r.commission_bps)/10000)::integer END,coalesce((SELECT sum(CASE WHEN x.kind='transfer' THEN x.amount ELSE -x.amount END) FROM creator_transfer_operations x WHERE x.order_id=r.id AND x.provider_id IS NOT NULL),0)::integer FROM creator_receipts r WHERE r.trainer_id=auth.uid() AND r.paid_at>=p_start AND r.paid_at<p_end
 UNION ALL SELECT 'program',CASE WHEN o.refund_pending OR EXISTS(SELECT 1 FROM program_disputes d WHERE d.order_id=o.id AND d.status IN ('open','lost')) THEN 0 ELSE floor(greatest(o.price_cents-o.refunded_cents-o.fee_cents,0)::numeric*(10000-o.commission_bps)/10000)::integer END,coalesce((SELECT sum(CASE WHEN x.kind='transfer' THEN x.amount ELSE -x.amount END) FROM program_payout_operations x WHERE x.order_id=o.id AND x.provider_id IS NOT NULL),0)::integer FROM program_orders o WHERE o.trainer_id=auth.uid() AND o.paid_at>=p_start AND o.paid_at<p_end)
 SELECT jsonb_build_object(
 'followers',(SELECT count(*) FROM profiles WHERE coalesce(extra->'followed','[]') ? auth.uid()::text),
 'newFollowers',(SELECT count(*) FROM creator_follow_events WHERE trainer_id=auth.uid() AND followed AND created_at>=p_start AND created_at<p_end),
 'unfollows',(SELECT count(*) FROM creator_follow_events WHERE trainer_id=auth.uid() AND NOT followed AND created_at>=p_start AND created_at<p_end),
 'videoViews',(SELECT count(*) FROM creator_playbacks WHERE trainer_id=auth.uid()),
 'periodViews',(SELECT count(*) FROM creator_playbacks WHERE trainer_id=auth.uid() AND created_at>=p_start AND created_at<p_end),
 'reportedWatchSeconds',NULL,'measurement','Views count authorized playback starts since Creator Studio rollout; watch time is unavailable until reliable player checkpoints are connected. Growth events start at rollout. Revenue is net trainer earnings from dated receipts, adjusted for current refunds/disputes; transfers are tied to those receipts, not bank payouts.',
 'trybeMembers',(SELECT count(*) FROM trybe_memberships WHERE trybe_id='coach-'||auth.uid()),
 'newTrybeMembers',(SELECT count(*) FROM trybe_memberships WHERE trybe_id='coach-'||auth.uid() AND joined_at>=p_start AND joined_at<p_end),
 'subscribers',(SELECT count(DISTINCT user_id) FROM creator_receipts WHERE trainer_id=auth.uid() AND creator_has_access(user_id,trainer_id)),
 'earnings',coalesce((SELECT jsonb_object_agg(source,total) FROM(SELECT source,sum(earned) total FROM revenue GROUP BY source) r),'{}'),
 'totalEarned',coalesce((SELECT sum(earned) FROM revenue),0),'completedTransfers',coalesce((SELECT sum(transferred) FROM revenue),0),'pendingTransfers',coalesce((SELECT sum(greatest(earned-transferred,0)) FROM revenue),0),
 'unreadMessages',(SELECT count(*) FROM messages m WHERE m.recipient_id=auth.uid() AND NOT EXISTS(SELECT 1 FROM message_controls c WHERE c.user_id=auth.uid() AND c.other_id=m.sender_id AND (c.blocked OR c.muted OR c.read_at>=m.created_at))),
 'newPartnerships',(SELECT count(*) FROM creator_partnerships WHERE trainer_id=auth.uid() AND status='new')) INTO result;RETURN result;
END $$;
CREATE FUNCTION public.creator_business_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE t uuid;key text;body text;BEGIN
 IF TG_TABLE_NAME='creator_receipts' THEN t=NEW.trainer_id;key='invoice:'||NEW.id;body='A subscription payment was recorded. Review its confirmed access and earnings.';
 ELSIF TG_TABLE_NAME='program_orders' THEN IF NEW.paid_at IS NULL OR OLD.paid_at IS NOT NULL THEN RETURN NEW;END IF;t=NEW.trainer_id;key='program-sale:'||NEW.id;body='A program payment was recorded. Review delivery and earnings.';
 ELSIF TG_TABLE_NAME='reviews' THEN IF NEW.trainer_id !~* '^[a-f0-9-]{36}$' THEN RETURN NEW;END IF;t=NEW.trainer_id::uuid;key='review:'||NEW.id;body='A member left a trainer review.';
 ELSIF TG_TABLE_NAME='messages' THEN t=NEW.recipient_id;key='message:'||NEW.sender_id||':'||current_date;body='You have a new message.';IF EXISTS(SELECT 1 FROM message_controls WHERE user_id=t AND other_id=NEW.sender_id AND (blocked OR muted)) THEN RETURN NEW;END IF;
 END IF;IF t IS NOT NULL AND EXISTS(SELECT 1 FROM profiles WHERE id=t AND role='trainer') THEN PERFORM creator_notify(t,key,body,'/studio');END IF;RETURN NEW;
END $$;
CREATE TRIGGER creator_receipt_notice AFTER INSERT ON public.creator_receipts FOR EACH ROW EXECUTE FUNCTION public.creator_business_notice();
CREATE TRIGGER creator_program_sale_notice AFTER UPDATE OF paid_at ON public.program_orders FOR EACH ROW EXECUTE FUNCTION public.creator_business_notice();
CREATE TRIGGER creator_review_notice AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.creator_business_notice();
CREATE TRIGGER creator_message_notice AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.creator_business_notice();
REVOKE ALL ON FUNCTION public.creator_business_metrics(timestamptz,timestamptz),public.creator_business_notice() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.creator_business_metrics(timestamptz,timestamptz) TO authenticated;
CREATE FUNCTION public.creator_comment_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE p posts%ROWTYPE;BEGIN SELECT * INTO p FROM posts WHERE id=NEW.post_id;IF p.author_id<>NEW.author_id AND EXISTS(SELECT 1 FROM profiles WHERE id=p.author_id AND role='trainer') THEN PERFORM creator_notify(p.author_id,'comment:'||NEW.id,'A member commented on your community post.','/trybes?t='||p.trybe);END IF;RETURN NEW;END $$;
CREATE TRIGGER creator_comment_notices AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.creator_comment_notice();
CREATE FUNCTION public.creator_payout_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE t uuid;BEGIN IF NEW.provider_id IS NULL OR OLD.provider_id IS NOT NULL THEN RETURN NEW;END IF;IF TG_TABLE_NAME='creator_transfer_operations' THEN SELECT trainer_id INTO t FROM creator_receipts WHERE id=NEW.order_id;ELSE SELECT trainer_id INTO t FROM program_orders WHERE id=NEW.order_id;END IF;PERFORM creator_notify(t,'transfer:'||NEW.id,'A confirmed transfer or reversal updated your earnings ledger. Bank payout timing remains subject to Stripe.','/studio?section=earnings-payouts');RETURN NEW;END $$;
CREATE TRIGGER creator_subscription_payout_notice AFTER UPDATE OF provider_id ON public.creator_transfer_operations FOR EACH ROW EXECUTE FUNCTION public.creator_payout_notice();
CREATE TRIGGER creator_program_payout_notice AFTER UPDATE OF provider_id ON public.program_payout_operations FOR EACH ROW EXECUTE FUNCTION public.creator_payout_notice();
CREATE FUNCTION public.creator_schedule_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE u uuid;BEGIN IF NEW.session_type='scheduled' THEN FOR u IN SELECT id FROM profiles WHERE id<>NEW.trainer_id AND coalesce(extra->'followed','[]') ? NEW.trainer_id::text LOOP PERFORM notify_account(u,'scheduled:'||NEW.id,'session','A trainer you follow scheduled a live class. Subscription and drop-in terms apply.','/live');END LOOP;END IF;RETURN NEW;END $$;
CREATE TRIGGER creator_scheduled_followers AFTER INSERT ON public.live_sessions FOR EACH ROW EXECUTE FUNCTION public.creator_schedule_notice();
REVOKE ALL ON FUNCTION public.creator_comment_notice(),public.creator_payout_notice(),public.creator_schedule_notice() FROM PUBLIC,anon,authenticated;
COMMIT;
