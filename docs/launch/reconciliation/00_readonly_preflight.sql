-- STAGING FIRST. This query reads counts only and does not change data.
-- Run in the independent staging clone before 01_stage_apply.sql; all failures
-- must be zero. Repeat on a freshly inspected/approved hosted schema only later.
BEGIN READ ONLY;
SELECT 'unsupported_private_status' AS check_name,count(*) AS failures
 FROM public.private_session_access WHERE status NOT IN ('paid','refunded','cancelled')
UNION ALL SELECT 'duplicate_active_private_slots',count(*) FROM (
 SELECT trainer_id,day,time FROM public.private_session_access WHERE status='paid'
 GROUP BY trainer_id,day,time HAVING count(*)>1) duplicates
UNION ALL SELECT 'orphan_video_reviewers',count(*) FROM public.trainer_videos v
 WHERE v.reviewed_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=v.reviewed_by)
UNION ALL SELECT 'orphan_friend_request_accounts',count(*) FROM public.friend_requests r
 WHERE NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.requester_id)
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=r.recipient_id)
UNION ALL SELECT 'self_friend_requests',count(*) FROM public.friend_requests WHERE requester_id=recipient_id
UNION ALL SELECT 'wallet_unit_count_mismatch',count(*) FROM public.wallet_token_lots l
 WHERE l.purchased<>(SELECT count(*) FROM public.wallet_token_units u WHERE u.lot_id=l.id)
UNION ALL SELECT 'wallet_remaining_mismatch',count(*) FROM public.wallet_token_lots l
 WHERE l.remaining<>(SELECT count(*) FROM public.wallet_token_units u WHERE u.lot_id=l.id AND u.state='available')
ORDER BY check_name;
COMMIT;
-- Stop on any nonzero count. Do not delete rows, fabricate purchases, repair
-- balances or approve reviewers to make checks pass; review the actual records.
