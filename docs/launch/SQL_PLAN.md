# Ordered Supabase SQL — review and staging first

Nothing in this engineering pass was executed against hosted Supabase. Read [FOUNDER_HANDOFF.md](FOUNDER_HANDOFF.md) for the exact dashboard, backup, acceptance and rollback sequence. Isolated PostgreSQL tests verify functions, constraints, grants, RLS and replay; they do not certify the hosted schema or Storage HTTP behavior.

## Few-step SQL Editor sequence

1. Back up and restore a staging copy; run the complete [preflight.sql](preflight.sql). Inspect the manually installed message policy, actual columns/constraints, administrator grants, triggers and bucket limits. Missing/incompatible schema is a stop requiring reconciliation, never a reason to erase data.
2. Choose **one** complete atomic bundle: [upgrade.sql](upgrade.sql) for reconciled historical `0000–0018`, or [completion.sql](completion.sql) for the reconciled `0050` launch baseline. Both have baseline guards, `BEGIN`/`COMMIT`, and were replayed while preserving an existing deposit. Do not execute fragments or both bundles. The completion bundle is `0051 → 0052 → 0053 → 0054`.
3. Run [confirmation.sql](confirmation.sql), check `0054_launch_completion`, then perform real JWT/browser/provider acceptance. Owner SQL Editor reads do not exercise RLS.

`npm run db:bundle` only regenerates artifacts. `npm run db:check` and `npm run db:types` use isolated PostgreSQL, not Supabase. The full bundle includes every upgrade below in filename order. Do not rerun historical table-creation migrations on an existing database or run the obsolete root `0019_live_eligibility_guard.sql`.

## Full upgrade order

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
34. [`0051_safety_and_messaging.sql`](../../migrations/0051_safety_and_messaging.sql)
35. [`0052_notifications_and_eligibility.sql`](../../migrations/0052_notifications_and_eligibility.sql)
36. [`0053_verified_live_attendance.sql`](../../migrations/0053_verified_live_attendance.sql)
37. [`0054_private_deposits.sql`](../../migrations/0054_private_deposits.sql)

## Data preservation and rollback

The upgrade supplies the missing historical review contract; private submitted evidence/review history is immutable. It migrates membership and purchased-wallet authority without trusting editable profile JSON. Known purchased units and prior paid version-1 private bookings remain, and no second deposit/balance is added to legacy bookings. Profile-only purchases require actual Stripe reconciliation. Store/program data and participant-only friend messages remain.

The old exact fictional seed cleanup remains in the inherited upgrade; no new test data or engagement is seeded. Review its identifiers in staging. New restrictive message/report/audience guards constrain an unexpected older permissive policy while preserving participant reads. New private reusable payment identifiers have no client SELECT grant. The moderator's account directory is allowlisted; administrators do not gain general access to private wellness profiles or DMs.

A failed transaction rolls back; use `ROLLBACK;` if the editor still has an open transaction. After a successful apply, keep the additive schema and financial history. Pause checkout and prepare a reviewed forward fix. Dropping tables or reverting only the Worker cannot safely undo external Stripe events or new deposit states. Restoring a backup requires a coordinated, separately approved procedure and reconciliation of events received since that backup. No production apply, rollback, deployment or DNS change was performed.
