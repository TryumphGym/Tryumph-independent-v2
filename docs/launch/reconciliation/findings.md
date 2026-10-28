# Hosted schema reconciliation — October 27, 2026

The actual export is complete: **978 rows including the matching completion row**, captured October 27 at **12:12:32 p.m. America/Chicago (17:12:32 UTC)**, PostgreSQL 17.11. SHA256: `ff398e74cff50c1315a3200a4b27e1a7ab0af13089feecabe434a61e1f7638f3`. Comparison target: draft PR #2 at `3f60ba09a4364043944b0672faf0f3f5b2d2374e`, ordered migrations through `0056`. Neither historical bundle is safe unchanged for this database. Missing migration history was **not** used to choose a baseline.

The metadata was reconstructed in isolated PostgreSQL/PGlite. All **785 inspected application objects** reproduced the supplied definitions and grants exactly after normalizing routine CRLF line endings. Supabase auth/storage internals, role ownership and provider behavior are emulated, not certified. No hosted database connection, business-data export, migration, merge, deployment, DNS change or provider operation was performed.

## Complete comparison

[object-comparison.json](object-comparison.json) inventories every object, its status and differing fields. [The metadata fixture](../../../src/test/fixtures/hosted-schema-metadata.json) retains supplied application DDL/ACL evidence, without account/message/payment records. `npm run db:reconcile:compare -- <complete-export.csv>` reproduces the inventory offline against the pinned migration endpoint.

| Catalog object | Matches | Differs | Missing from hosted | Hosted only |
| --- | ---: | ---: | ---: | ---: |
| Public relations, including grants | 17 | 28 | 18 | 2 |
| Columns, including explicit column ACLs | 316 | 23 | 119 | 10 |
| Constraints | 141 | 5 | 64 | 13 |
| Indexes | 63 | 2 | 27 | 8 |
| Policies, including application Storage policies | 65 | 5 | 75 | 24 |
| Application triggers | 12 | 0 | 12 | 2 |
| Public routines, including definitions/configuration/grants | 28 | 17 | 45 | 4 |

These are definition comparisons, not instructions to create/drop every named object. Equivalent policies/checks with different names, formatting, safer hosted grants and dormant features require the treatment below. PG18's separate NOT NULL constraint objects are excluded because hosted PG17 records that property on columns; column nullability is compared directly. Column ordinal positions/owners are excluded from status, with owner differences reported separately. The staging guard is stricter: all 785 supplied application definitions, positions, ownership and grants must match, with no extra application objects.

## Tables and columns

All **45 existing canonical tables** match relation kind and RLS settings. The 28 relation differences are ACL differences, not missing/recreated tables. Preserve additional `public.trybes` and `public.comments` tables, their records, policies, indexes and column grants.

The 18 missing tables are `account_activity_days`, `account_notifications`, `account_restrictions`, `audience_announcements`, `contact_delivery_requests`, `content_reports`, `launch_schema_versions`, `legacy_friendship_grants`, `message_controls`, `moderation_actions`, `moderation_appeals`, `notification_preferences`, `private_balance_operations`, `private_booking_payments`, `private_payment_methods`, `private_reschedule_requests`, `private_room_shutdown_jobs`, and `trainer_credential_requirements`.

Of 119 missing columns, **101 belong to missing tables**. Only 18 need adding to existing tables: `posts.official`, `post_comments.is_hidden`, `private_booking_holds.total_cents/terms_version`, eleven private-access payment/delivery/transfer fields, `refund_jobs.last_error/attempts`, and `trainer_earnings.fulfillment_pending`. The apply contains exact definitions. Existing paid private rows receive `payment_version=1`; no payments, delivery confirmations or fees are fabricated.

Of 23 differing existing columns, **20 differ only in column ACLs**. Keep stricter hosted INSERT/UPDATE grants on certifications, posts and membership identifiers. These are not missing table-level permissions: admin credential review already has column UPDATE privileges. The three structural differences are workout `equipment`'s default and nullable/no-default `required_equipment` / `optional_equipment`. Retain existing NULLs and legacy equipment text; current matching uses `required_equipment ?? gearOf(equipment)`. Do not rewrite videos or default legacy requirements to empty arrays.

## Constraints and indexes

Of five differing constraints, retain both friend-request FK `ON DELETE CASCADE` actions and reversed membership PK column order (same uniqueness). Retain the broader membership ID length check: hosted includes real member-created Trybes. Replaying the canonical narrow check would reject their identifiers. Extend only the private booking status check for deposit/balance/hold/transfer states, retaining all original states.

Missing canonical `friend_requests_check` already exists as `no_self_friend_request`; do not duplicate it. The only other missing constraint on an existing table is `trainer_videos_reviewed_by_fkey`. Add it **NOT VALID**, check historical reviewer references, then validate separately in staging. Do not delete/reassign orphan reviewers. Other missing constraints belong to new tables. Keep extra hosted certification/video user FKs, member-Trybe checks and indexes. Of two differing indexes, retain membership PK order and widen only `private_active_slot`'s active-status predicate with the same `(trainer_id,day,time)` uniqueness. Existing paid-slot duplicates/unsupported statuses must fail preflight.

## Routines and triggers

The **28 exact routine matches** include the signup profile function, credential/workout guards, paid token/live/legacy-private settlement, operation claims, class cancellation/refund queue and room shutdown. Preserve their identities and records. Twelve matching public triggers include credential, financial, workout, eligibility/calendar/cancellation/shutdown guards. Keep the two additional hosted bindings, `profile_identity_guard` and `guard_official_posts`.

Of 17 differing routines, retain `review_trainer_video(uuid,text,text)`'s optional `p_note DEFAULT ''`, positional implementation and grants; it is behaviorally compatible. Retain `can_edit_menu`'s equivalent formatting/stricter grants because Nutrition remains paused. Retain `has_role`'s fully qualified body and empty search path; grant only explicit anon/authenticated/service execution needed by existing public-content policies. Do not replace it with the historical broader PUBLIC grant.

The other 14 differences implement launch behavior: account/required-credential/time-zone eligibility; reserve-versus-attend wallet consumption; installment-aware refunds/cancellations/disputes and legacy restoration; deposit-state calendar conflicts; audited moderation/official publishing; coach-owned Trybe access; accept/unfriend security. Apply their reviewed replacements with unchanged signatures/returns and add missing launch routines. Missing `share_menu` and dormant Nutrition/Youth policies intentionally remain closed. Do not activate paused features to make catalogs identical.

Add notification/message/request/identity/private-shutdown triggers. Keep the hosted identity guard alongside the new role guard; neither migration rewrites accounts. The original inspection does not include `auth.users` trigger bindings or event-trigger registrations. [03_inspect_platform_bindings.sql](03_inspect_platform_bindings.sql) captures these remaining platform facts read-only. A matching signup function does not prove its trigger is bound.

## Manual trainer inquiry policy and friendships

**`Trainer inquiries may be sent without friendship` exists and is permissive.** Its previous-message branch deparses to `previous.sender_id = previous.recipient_id AND previous.recipient_id = previous.sender_id`. Unqualified names resolved inside the subquery, not to the new outer message. Initial inquiries directly query another trainer's `profiles` row, which ordinary members cannot see under hosted profile RLS. A historical self-addressed message could make the reply branch unrelated to its intended conversation. Policy presence therefore does not establish working/safe inquiries.

Reconcile its **existing name** with `ALTER POLICY ... WITH CHECK (public.can_send_message(sender_id,recipient_id))`, remove only the redundant new `launch_trainer_inquiries` permissive policy, and retain separate restrictive insert/participant-read guards. The helper checks sender identity, accepted friendship or eligible inquiry/reply history, blocks and account restrictions; the trigger enforces canonical names/rate limits. Existing participant reads and accepted-friend sends remain. Admins gain no unrelated DM history.

Hosted `can_message_friend` requires **both** friendship rows. This path adapts `0056`'s legacy grant backfill to mutual rows only; an unaccepted one-sided `partner=true` row must not gain permission. Existing requests, accepted relationships and conversation history remain. A restrictive request-insert guard retains the hosted prohibition on requesting an already accepted friend; a less restrictive permissive policy alone would bypass it. Accept/unfriend remains an authorized user action, never migration-time deletion.

## Grants, policies and Storage

The export confirms **anon/authenticated TRUNCATE and related maintenance grants on application/financial tables**, including refund/dispute/wallet/recording ledgers. RLS does not protect TRUNCATE. Revoke client TRUNCATE/REFERENCES/TRIGGER/MAINTAIN on public application tables, retaining ordinary DML and column grants. Remove those confirmed defaults for **postgres-owned public tables** too. Leave Supabase-owned roles/schemas/service defaults alone. Supabase-admin-owned public defaults remain broad and require platform-aware review if that role will create future application tables; all new feature tables receive explicit ACLs/RLS.

Some missing grants/policies are real gaps: trainer earnings/Connect own-or-admin reads, push subscriptions/reminders, review reads/inserts, admin waitlist reads, avatar and private own-folder video Storage access. Add reviewed contracts. Some are equivalent policy names or safer column grants; retain those. Five differing policies include three equivalent credential initplan/qualification forms, the narrower canonical membership insertion check and equivalent own-role SELECT form. Do not replace them just to match text. Existing extra permissive policies combine with new restrictive guards; no unrelated broad read policy is introduced.

The actual `trainer-certificates` bucket is already **private**, **10 MB**, PDF/JPEG/PNG/WebP only. Seven credential Storage policies, three restrictive credential table policies and profile/video read guards match. Keep bucket configuration/evidence/history. Videos are private (3 GB); avatars/store images public (5 MB image-only). Add missing scoped Storage policies; real Storage API behavior/DDL permissions remain staging gates.

`app_role` labels match (`admin`, `moderator`, `user`). Public application objects are postgres-owned. Anon/authenticated have neither superuser nor BYPASSRLS; service_role has expected BYPASSRLS. All six allowlisted application registries are absent; auth/realtime/storage platform migration relations exist but are not application baseline evidence. No publication membership rows exist for inspected relations; publication definitions were outside the original report. Do not claim Realtime is configured. Verify actual two-account delivery/polling separately. Keep installed extensions/platform roles.

## Exact safe staging sequence

1. Retain database **and Storage-file backups**, restore a separate Supabase staging project, pause its app/cron/provider workers and isolate sandbox credentials. Verify the dashboard project identity. This work authorizes no production/provider operation.
2. Optionally run [03_inspect_platform_bindings.sql](03_inspect_platform_bindings.sql) read-only on hosted for signup/event/publication facts. Run the original full inspection on staging; its application definitions must match the supplied snapshot. Ownership/ACL/deparse differences require review, not removing guards.
3. Run **[00_readonly_preflight.sql](00_readonly_preflight.sql)** on staging. All seven counts must be zero: unsupported private statuses, duplicate active slots, orphan video reviewers, orphan/self requests, wallet unit-count mismatch and remaining-unit mismatch. These have **not** been run on hosted business data. Stop on a failure; never erase records, fabricate purchases/balances or relabel approvals to pass.
4. Run **all [01_stage_apply.sql](01_stage_apply.sql)** on staging: exact snapshot guard → repeated data checks → locked aggregate preservation baselines → reviewed `0051–0056` with mutual-friend adaptation → `0057` compatibility → unchanged-original-row assertions → commit. This is a new reconciled transaction, not either old bundle. It adds missing objects and replaces specified function/policy/trigger/status/index definitions. It drops no table/business row, invokes no settlement/maintenance RPC, backfills no purchase and initiates no charge.
5. Run **[02_validate_staging.sql](02_validate_staging.sql)** to validate the additive reviewer FK and check table RLS, inquiry reconciliation, maintenance grants and payment/attendance RPC privileges. Require `staging_catalog_validation_passed`. Then run [confirmation.sql](../confirmation.sql), export fresh metadata and complete actual JWT/browser/provider acceptance in [FOUNDER_HANDOFF.md](../FOUNDER_HANDOFF.md).
6. Compare restored counts/legacy fields/financial totals before and after. The transaction already aborts on any original public-row change. Verify both friend inboxes, requests/accept/unfriend, inquiries/replies, stranger/spoof/block denial, private audiences/official notices, own stores, credentials/evidence and approved videos. Legacy paid bookings must never request another payment. New deposits/attendance/refunds require sandbox provider verification.

The apply **refuses replay** after the snapshot advances; it never uses a marker alone to justify rerunning backfills. Read-only checks/validation are repeatable. On an error leaving the editor transaction open, issue `ROLLBACK;`, retain the error and reinspect. Large checksum scans/locks can time out safely; review staging size rather than weakening guards. After a committed apply, prepare a forward fix; do not drop additive tables, reverse financial history or restore over newer provider events. A production proposal requires fresh inspection/data validation and separate authorization after staging acceptance.

## Verification and remaining blockers

See [validation.md](validation.md). Automated tests reconstruct actual application metadata with **isolated test fixtures only**. They cover unchanged original records, paid legacy state, manual inquiry reconciliation, accepted friends, requests/unfriend, denied strangers/spoofs/blocks/admin DM reads, official/audience publishing, strict column grants, public approved videos, deposit replay and drift/replay rejection.

Both old bundle problems are reproduced: full upgrade attempts to remove `review_trainer_video`'s default and PostgreSQL rejects it; completion applies yet publishing fails with the existing announcement trigger. The new path fixes those conflicts while retaining the stronger default/search-path/column contracts.

Real hosted business-data compatibility, restore completeness, actual Supabase ownership/Storage HTTP, PostgREST/JWT/Realtime behavior, email, Stripe, LiveKit, Bunny and ad-provider approval remain **unverified**. No launch-complete or production-tested claim is made.
