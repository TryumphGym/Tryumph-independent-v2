# Ordered Supabase SQL execution plan — later phase

**Nothing in this task was executed against hosted Supabase.** The code was tested with an isolated PostgreSQL engine and emulated Supabase platform schemas. That verifies migration syntax, constraints, transactions and RLS, while storage HTTP enforcement, the real schema history and production data still need staging verification.

## Files to use

For an existing database with historical migrations **0000–0018 already reconciled**, use the complete generated [`upgrade.sql`](upgrade.sql). It contains the missing review contract followed by every launch migration through 0050, in a single transaction. It stops if core historical tables are missing. Inspect the preflight below first; take a backup and apply the bundle to a staging copy before the later authorized production SQL step.

`npm run db:bundle` rebuilds this file without executing SQL. `npm run db:check` runs the full migration history in an isolated engine. `npm run db:types` derives the application contracts from those same files. No GitHub push automatically applies SQL.

Do not run historical migrations 0000–0018 again on an existing database: they include initial table creation. Fictional seed declarations have been removed for new installations. The new upgrade removes only the specifically identified fictional seed rows from 0002; it preserves real user-authored data. Do not execute the obsolete root `0019_live_eligibility_guard.sql` separately: it competes with the current trigger and has a historical date-pattern defect. The ordered upgrade replaces that trigger safely.

For a genuinely empty **Supabase** staging project, first run 0000–0018 in filename order, then `upgrade.sql`. Plain PostgreSQL lacks Supabase's `auth`, `storage`, platform roles and publication; the test harness emulates only those prerequisites.

## Read-only preflight

Run this in staging / the later SQL review, not during the coding task:

```sql
select name, to_regclass('public.' || name) is not null as present
from unnest(array['profiles','user_roles','certifications','trainer_videos',
 'trainer_earnings','trainer_accounts','trainer_busy','live_sessions',
 'posts','post_comments','post_likes','waitlist_entries']) as name;

select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public' and table_name in
 ('profiles','certifications','trainer_videos','live_sessions','trainer_earnings')
order by table_name,ordinal_position;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

select id,public,file_size_limit,allowed_mime_types
from storage.buckets
where id in ('trainer-certificates','videos','avatars','trainer-store-images');

select tgname,pg_get_triggerdef(oid) from pg_trigger
where not tgisinternal and tgrelid in
 ('public.profiles'::regclass,'public.certifications'::regclass,
  'public.trainer_videos'::regclass,'public.live_sessions'::regclass);
```

If core historical tables or incompatible column types are missing, stop rather than running an incomplete prefix or deleting existing data. The hosted schema was not accessible with server credentials in this task, so its exact migration history cannot be certified. Reconcile the staging schema against the historical files and regenerate types after any intentional differences. The code does not assume that an existing production database is empty.

## Compatibility and data preservation

- `0018a_review_contract.sql` supplies the review/equipment/document fields already referenced by the source snapshot. Existing approved/rejected states are retained. When review status is entirely missing, existing videos default to pending; review them before public discovery.
- Upgrade scripts add missing columns, recreate their named policies/triggers, and replace functions in deterministic order. Later definitions intentionally supersede earlier versions. Use the **whole transaction**: intermediate policies and financial functions must never become the live final state of a partial apply.
- Existing membership JSON is backfilled into authoritative membership rows before RLS switches. It does not remain an ongoing authority for private posts. Public/private post visibility is added with private as the default; only the trainer leading that Trybe may publish public posts.
- Submitted credentials and evidence remain auditable, with immutable files and append-only review decisions. Admins cannot review their own credentials/videos. Existing admin roles must be audited: historical migration 0005 granted the owner role from an email string at signup. The new signup handler does not do that.
- Store listings and ordered programs retain their own tables. External store sales bypass Tryumph revenue sharing. Public program reads never expose unapproved videos or another trainer's video.
- Wallet lots, individual units and immutable redemptions replace mutable profile balances as paid authority. Existing purchased lot balances are preserved; backfilled previously spent units do not create new spendable credits. Profile-only balances / legacy paid bookings need reconciliation against actual Stripe purchases before restoring entitlement. Preserve historical JSON and ledger rows as evidence; do not grant access from them alone.
- Paid private reservations now use holds, participant access rows and the Central time zone. Paid class grants lock the class against concurrent cancellation. A refunded/cancelled slot can be booked again without deleting financial history.
- Refunds retain original earnings, record cumulative reversal targets and preserve transfer operations through concurrent events. Disputes suspend access; won disputes can create recovery adjustments. Fractional token refunds queue completion of the affected whole $5 unit. Review these business rules with actual Stripe test-mode events.
- The upgrade adds restrictive guards to protect private documents/video metadata even if an older permissive read policy remains. It revokes client financial writes. Review all other custom storage policies and unrelated grants during staging verification.
- Tables and constraints that already exist with an incompatible definition require review; `IF NOT EXISTS` is not proof that a production table has the expected shape. Never fix a mismatch by dropping real account or financial data.

## Exact upgrade order

The generated transaction contains these files, in this order:

1. [`0018a_review_contract.sql`](../../migrations/0018a_review_contract.sql)
2. [`0019_launch_feature_data.sql`](../../migrations/0019_launch_feature_data.sql)
3. [`0020_trybe_membership_security.sql`](../../migrations/0020_trybe_membership_security.sql)
4. [`0021_live_room_access.sql`](../../migrations/0021_live_room_access.sql)
5. [`0022_ad_settlement_events.sql`](../../migrations/0022_ad_settlement_events.sql)
6. [`0023_payment_lifecycle.sql`](../../migrations/0023_payment_lifecycle.sql)
7. [`0024_water_break_sponsors.sql`](../../migrations/0024_water_break_sponsors.sql)
8. [`0025_live_recording_events.sql`](../../migrations/0025_live_recording_events.sql)
9. [`0026_verified_ads_atomic.sql`](../../migrations/0026_verified_ads_atomic.sql)
10. [`0027_refunds_transfer_reversals.sql`](../../migrations/0027_refunds_transfer_reversals.sql)
11. [`0028_wallet_live_redemption.sql`](../../migrations/0028_wallet_live_redemption.sql)
12. [`0029_recording_import.sql`](../../migrations/0029_recording_import.sql)
13. [`0030_store_images_and_program_reorder.sql`](../../migrations/0030_store_images_and_program_reorder.sql)
14. [`0031_private_sessions.sql`](../../migrations/0031_private_sessions.sql)
15. [`0032_sponsor_creative_type.sql`](../../migrations/0032_sponsor_creative_type.sql)
16. [`0033_launch_eligibility_security.sql`](../../migrations/0033_launch_eligibility_security.sql)
17. [`0034_trybe_moderation.sql`](../../migrations/0034_trybe_moderation.sql)
18. [`0035_launch_authorization.sql`](../../migrations/0035_launch_authorization.sql)
19. [`0036_payment_retry_safety.sql`](../../migrations/0036_payment_retry_safety.sql)
20. [`0037_payout_operations.sql`](../../migrations/0037_payout_operations.sql)
21. [`0038_cancellation_refunds.sql`](../../migrations/0038_cancellation_refunds.sql)
22. [`0039_recording_jobs.sql`](../../migrations/0039_recording_jobs.sql)
23. [`0040_content_and_calendar.sql`](../../migrations/0040_content_and_calendar.sql)
24. [`0041_checkout_intents.sql`](../../migrations/0041_checkout_intents.sql)
25. [`0042_booking_reservations.sql`](../../migrations/0042_booking_reservations.sql)
26. [`0043_ad_measurements.sql`](../../migrations/0043_ad_measurements.sql)
27. [`0044_contract_hardening.sql`](../../migrations/0044_contract_hardening.sql)
28. [`0045_payment_disputes.sql`](../../migrations/0045_payment_disputes.sql)
29. [`0046_recording_shutdown.sql`](../../migrations/0046_recording_shutdown.sql)
30. [`0047_workout_metadata.sql`](../../migrations/0047_workout_metadata.sql)
31. [`0048_live_visibility.sql`](../../migrations/0048_live_visibility.sql)
32. [`0049_wallet_units.sql`](../../migrations/0049_wallet_units.sql)
33. [`0050_restrictive_guards.sql`](../../migrations/0050_restrictive_guards.sql)

## Verify after staging apply

Run the same role/row scenarios covered in `src/test/launch-security.test.ts` with real test accounts: member, trainer, second trainer, and independent admin. Confirm there is one active eligibility trigger, only approved public videos, no anonymous credential reads, no member finance/role writes, and no cross-Trybe mutations. Verify actual Storage MIME/size enforcement and signed file access through Supabase's HTTP APIs. Exercise webhook retries and a queue retry before any live payment.

Keep a backup and the precise reviewed SQL artifact. If the transaction fails, roll it back and investigate the reported incompatibility in staging; do not run a smaller suffix blindly or remove constraints to force success. Production application remains a separate explicitly approved step after code review, credentials, and test-mode verification.
