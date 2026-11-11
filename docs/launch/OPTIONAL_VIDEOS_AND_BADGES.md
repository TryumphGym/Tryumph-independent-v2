# Optional on-demand uploads and trainer achievement badges

## Product behavior
- Verified trainers may host scheduled and spontaneous live classes with **zero** approved on-demand uploads.
- The existing trainer role, current independently verified CPR/AED, additional required credentials, account restrictions and payout eligibility are not relaxed.
- Free, approved public workouts remain an optional discovery channel.
- Five display-only achievements: First Workout (1 public workout), Workout Builder (5), Workout Library (25), First Live (1 ended class), Live Regular (10 ended classes).
- Badges are calculated from server/database records; profile JSON and client-supplied counts are never accepted.
- Badge labels are activity milestones only, **not professional certifications**. They do not grant Spotlight, preferential placement, payout privileges, or payment changes.

## Verification and rollout
1. Test on an isolated staging clone before applying `migrations/0077_optional_on_demand_for_live.sql` to any hosted project; do not replay the earlier migrations against production.
2. Run `npm run db:check`, `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`.
3. Test a verified zero-video trainer, a trainer with expired credentials, an ineligible payout account, and a restricted account using actual Supabase roles. Confirm both scheduled and spontaneous live hosting.
4. Verify first public approved workout and first provider-completed live milestones; ensure pending/unreviewed content and scheduled/cancelled sessions never count.
5. Deploy application and matching database migration together after staging acceptance. Before the migration, the hosted database will still enforce the five-video rule.

Later, a separate approved design can offer earned, free featuring with anti-spam controls, fair rotation, measurable placement opportunities and clear commercial terms. No featured perks should be switched on by these display badges.
