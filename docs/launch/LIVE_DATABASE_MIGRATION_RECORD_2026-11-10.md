# Hosted database deployment record — November 10, 2026

## Target and safety

Supabase project: `TryumphGym` (`ptdoswinanmsldyefsjs`), PostgreSQL 17.
The founder authorized using the existing project because a second staging project is unaffordable.

**This was a direct hosted database upgrade, not independent staging or end-to-end provider acceptance.** No off-project database backup, Storage-file restore, browser/JWT multi-account acceptance or Stripe/LiveKit/Bunny/Resend verification was performed. Do not treat migration success as launch approval.

Before modifications, the seven original business-data preflight checks all returned zero. The public schema contained 47 RLS-enabled tables. An isolated backup of public-table **rows** was made inside the same database in non-exposed, privilege-restricted schema `tryumph_backup_20261110`; it is not a disaster-recovery backup and does not contain Storage file bytes. All 47 copied tables were compared against the corresponding original pre-upgrade columns following the migration sequence and matched.

## Applied changes

1. Revoked `TRUNCATE` for `anon` and `authenticated` on every public application table where it existed; verified zero public tables still expose client TRUNCATE.
2. Foundation upgrade equivalent to `docs/launch/reconciliation/01_stage_apply.sql` (migrations 0051–0057, including the hosted mutual-friend adaptation) was modified **only in its initial snapshot precondition** to reflect actual November 10 catalog drift. The new precondition asserted the **791 inspected catalog objects** and exact normalized SHA-style aggregate fingerprint `4231f275d598a74630f41cb46d132fbf` captured that day. The seven data preflight and original-row preservation assertions remained. The complete transaction passed a rollback-only rehearsal before being committed. Newer policies for authenticated live visibility, trainer-video visibility, and own push reminders were preserved; do not replay the original October 27 schema guard or historical `upgrade.sql`/`completion.sql`.
3. `02_validate_staging.sql` was applied as catalog validation after foundation; the reviewer FK was validated.
4. Applied individual, ordered source migrations **0058 through 0073** from `codex/tryumph-january-launch`. Before applying, the complete sequence ran in one rollback-only transaction with an unchanged-original-public-row digest assertion. All 16 migrations committed individually.
5. Added and applied `0074_public_catalog_invoker_security.sql`: the public workout and live catalog views now use invoker RLS.
6. Added and applied `0075_public_program_discovery_rls.sql`: the public program view uses invoker RLS with a non-exposed, narrowly scoped boolean helper checking that the current program edition has been approved. Anonymous users were **not** granted access to the private `program_editions` table.

## Verified on hosted

- 128 public tables, **128 with RLS enabled**.
- Zero public tables grant client `TRUNCATE`.
- Four public views set `security_invoker=true`; database security advisor no longer flags `security_definer_view`.
- Original 47 public-table rows match the safety copies on original columns, including the historical financial tables.
- Payment settlement RPCs and photo review helpers checked are not directly executable by ordinary clients; private edition documents remain unreadable to `anon`.
- Membership sales, native program sales, community photo publishing, community ads and paid Spotlight inventory remain disabled in database settings.
- `supabase_migrations.schema_migrations` records the individual hosted operations through 0075; it does **not** retroactively contain one entry for every historical source 0051–0057.

## Remaining acceptance and risks

Supabase's advisor still shows INFO-only no-policy tables (many service-only) and WARN items for callable SECURITY DEFINER functions, mutable search paths and auth leaked-password protection. These warnings require individually reviewed privileges/function bodies and must not be fixed by broad, unreviewed revokes.

Do not enable paid memberships, checkout, private uploads, creator payments, image moderation, community ads, Spotlight sales or live money transfers without configured providers, server-only secrets, legal terms and actual test-mode acceptance. Existing paid history must not be charged again.

Before a live release/deployment: verify real JWT/browser access for at least two users and a trainer, verified media playback, paid sandbox flows, notifications and cron; confirm how Cloudflare deploys `main`. This record describes schema deployment only.
