# Tryumph HQ — Phase 1 founder overview

**Status:** Development branch, not deployed or merged. This is a real, read-only founder overview in the existing `/admin` page. No new paid providers, migrations, autonomous messages, social posts, payouts, or deployments.

## What it actually does

The panel reads fresh aggregate counts for pending trainer credentials, pending workout videos, open safety reports and appeals, unfinished refunds (including creator refunds), queued contact deliveries, seven-day waitlist signups, future scheduled lives, registered profiles and approved videos. Its review buttons scroll to existing admin review sections; they **do not approve, send, retry, pay, or deploy** anything.

It also displays the current **database-side** enablement flags for creator memberships, native program payments, community photos and community feed ads. These flags are not proof of runtime/provider readiness. GitHub checks, Cloudflare deployment health, Resend delivery, social schedules, outreach, and other provider checks are **not** connected in Phase 1. The interface says so.

## Security

- The `/admin` page already requires an admin role to render. Every HQ server request additionally verifies an authenticated admin role **and** that the caller's user ID matches the **server-only** `PROGRAM_TERMS_OWNER_ID` binding, already used for owner-only commercial approval.
- If this binding is not configured, HQ fails closed with a configuration error; it does **not** silently grant access to every admin. Set the existing owner UUID as a Cloudflare Worker *server secret*, not a public `VITE_` variable and never in Git.
- All aggregate queries use the server-only Supabase service client after the owner check. No private account, message, financial, or contact rows are returned.
- Server errors do not expose individual contact data. No actions or data-changing SQL are called by the panel.
- The metrics are exact current snapshot counts, not historical or analytics forecasts. Refresh is manual.

## Manual acceptance before merge

1. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` and `npm run db:check` on a clean checkout.
2. Verify an unsigned visitor and ordinary member cannot read any HQ counts.
3. Verify a non-owner admin cannot read any HQ counts.
4. Verify the correctly configured owner can load and refresh the existing count totals, and the review links navigate to the correct admin sections.
5. Verify removing `PROGRAM_TERMS_OWNER_ID` fails closed with a helpful error.
6. Verify normal certificate/video moderation, payments, and trainer workflows are unchanged.
7. Independently verify external providers, live site deployment and rollback plan before deciding whether to merge `main`.

## Next incremental stages

- GitHub pull request approvals and CI test results (requires installing and configuring a GitHub Actions workflow; never auto-deploy before review).
- Outreach inbox (only when an email provider is connected and sending permissions are explicitly authorized).
- Social content review and scheduling (only when a social provider is connected).
- A persistent approval queue with an audit log and strict owner-only RLS (requires a separate reviewed database migration).

**No fake activity, unattended outreach, automatic ad purchases, or implicit publishing.** Every external side effect should have an explicit approval action and an auditable result.
