# Tryumph Gym founder guide — November 2, 2026

This is the consolidated memory and operating guide for the January 1, 2027 launch. Dates in this guide use America/Chicago. It covers the existing launch engineering and hosted-schema reconciliation, Resend preparation, trainer programs and exercise variations, Trybe community polls, optional 90/10 trainer memberships, inclusive discovery, Pick For Me, Everyday Tryumphs, community feedback and gated photo/feed-ad foundations.

**Status: implemented development code, with external staging acceptance still required.** This guide is not authorization to run production SQL, merge, deploy, change DNS or activate live payments. No hosted SQL, deployment, DNS or real payment operations were performed during this work. Keep the development branch `codex/tryumph-january-launch`; preserve published Git history.

The downloadable edition adds the complete active SQL scripts as numbered appendices, with source paths and SHA256 hashes. Use the HTML or Markdown edition to copy SQL. PDF line wrapping is for reading, not authoritative SQL copying. The scripts are never executed by opening the guide or using its copy buttons. The generator excludes obsolete baseline bundles, private environment files, credentials and business-data exports.


## November 2 marketplace continuation — current authority

The subscription split was reconfirmed as **90% trainer / 10% Tryumph**, after actual payment-processing fees and before hosting. Programs remain 95/5. Community-feed advertisements belong 100% to Tryumph and never enter the 50/50 water-break video-ad ledger. Free Trybes/free on-demand remain available; subscriptions are optional trainer-specific products. The old five-video quota is removed, while all required current independently verified credentials remain.

Read `MARKETPLACE_IMPLEMENTATION.md`, `MARKETPLACE_VALIDATION.md` and the current `FOUNDER_HANDOFF.md`. The download includes those complete current documents before the dated source references. New transactional modules are 0060 memberships, 0061 content, 0062 discovery/downloads, 0063 everyday feedback/recommendations and 0064 photos/feed ads, applied only after verified foundation/0058/0059. Never select a baseline because history is missing. No hosted schema was changed.

Inclusive focus categories filter trainers, public workouts, programs and live classes for free and paying members. Trainer focus, verified qualifications and subjective Community Tags are distinct. Pick For Me enforces time/equipment/safety and never searches inaccessible premium content. Everyday Tryumphs offers small safe-task movement ideas. Feedback is private with configurable 10-member/70% minimum public thresholds. Photo uploads and feed ads remain disabled until the specific provider/legal steps pass; moderation adapter tests are not real vendor approval. Use the current handoff's acceptance checklist and false-by-default gates.

## 1. Your next steps, in order

1. Save this guide. The code is in `TryumphGym/Tryumph-independent-v2` on `codex/tryumph-january-launch`. Review draft PR #2; do not merge it as part of setup.
2. Back up the hosted database **and Storage files**. Restore a separate Supabase staging project. Verify the project identity before every SQL Editor operation. Keep its app, cron and provider workers paused while reconciling schema. Use only sandbox provider credentials there.
3. Establish the actual staging schema state using the read-only inspection and platform-binding queries. The last supplied hosted export was 978 rows, including its completion row, captured October 27, 2026, at 12:12:32 p.m. America/Chicago. There was no fresh hosted-schema verification during the programs or polls work.
4. Follow the migration decision table in section 5. Do not select a baseline from missing migration history. Never replay a module that already exists or bypass an inspection/preservation guard.
5. Configure provider settings using section 6 and the included configuration reference. Preserve the working auth flow and external stores. Keep native program checkout off outside the sandbox.
6. Complete the real-account acceptance scripts in section 8, including the pre-existing launch-critical workflows. Automated local tests do not establish real email delivery, payments, room permissions or CDN security.
7. Review unresolved blockers, backup/monitoring readiness and legal/customer-facing terms. Production SQL, deployment, main-branch merge, DNS changes and live Stripe activation each remain separately authorized founder actions.

## 2. Business rules that must remain intact

| Product / action | Rule |
| --- | --- |
| Trybe membership | A free option remains available. |
| Ordinary on-demand workouts | Free to members; advertising only at explicitly marked water breaks, never mid-set. No marked breaks means no ads. |
| Community live class | $5 drop-in unless an explicitly authorized change applies; reservation alone does not spend a token. |
| Private one-on-one | Trainer-defined price; new installment bookings use a 25% deposit and 75% balance under the verified attendance/payment rules below. |
| Native program sale | One-time purchase; trainer 95%, Tryumph 5% by default, after actual processing fees and before hosting/infrastructure. |
| Independent storefront / affiliate link | Trainer keeps 100%; Tryumph processes no external sale and takes no commission. A link visit does not verify a purchase. |
| Existing other splits | Private trainer 90%; community live and recognized advertising 50%. Actual processing fees precede each split. Program sales are a separate ledger. |
| Subscriptions | No mandatory recurring membership for members or mandatory trainer platform subscription. A poll about optional memberships does not create one. |
| Launch navigation | Youth, Nutrition and Homeschool remain hidden for January 1, 2027; their source is retained. Future central merchandise and Insights stay dormant. |

For the approved program example, $50.00 minus an actual $1.75 processing fee leaves $48.25. Trainer cents round down consistently to **$45.83**; Tryumph receives the remaining **$2.42**. Hosting costs are reported separately and do not reduce the trainer's distributable base. Server-side configuration defaults to 500 basis points (5%); only the explicitly configured owner can approve changed commercial settings for future orders. Prices and rates are never accepted from browser checkout claims.

## 3. What has been implemented

### Signup, identity and messaging

The existing Supabase signup, confirmation, reset, session and callback architecture is retained. Signup no longer bootstraps administrators by an email-string rule. Use a verified actual UUID and trusted administration for admin roles. The account dashboard JSX regression was repaired in the earlier launch work.

Accepted-friend messages and existing conversations are retained. Eligible member-to-trainer inquiries and trainer replies use checked server/database permissions rather than granting all strangers access. There are friend-request acceptance/unfriend guards, participant-only message reads, block/mute/report controls and rate limits. Admin safety review does not grant broad private-inbox surveillance.

The hosted manual policy named **Trainer inquiries may be sent without friendship** was inspected. Its unqualified subquery columns were correlated incorrectly and its direct profile lookup was restricted by profile RLS. The reconciled foundation keeps that policy's name and routes its check through `can_send_message`, retaining the separate restrictive permission guard. The programs and polls migrations do not replace messaging policies.

### Credentials and workout discovery

Eligibility uses current independently verified required credentials, including CPR/AED and assigned trainer-specific requirements. Trainer evidence is private, constrained to the trainer's own UUID folder, PDF/JPEG/PNG/WebP, at most 10 MB or an existing stricter limit. Submitted evidence cannot silently be replaced; renewals preserve historical decisions. Only admins can verify/reject.

Expired credentials block new trainer activity and new sales where required; previously approved workouts and legitimate existing program editions are preserved unless moderation withdraws content. An eligible replacement credential restores current eligibility rather than leaving an old expired row as a permanent lock.

All discovery groups exclude unapproved workouts. No-equipment workouts remain eligible regardless of owned equipment. Explicit safety incompatibilities cannot be overridden just to fill recommendations. The Best Matches, Close Matches and Explore All logic remains shared. The later marketplace requirement removes the five-video quota through 0060. Current verified required credentials remain mandatory; new paid scheduling separately requires eligible payouts. Programs do not replace credentials.

### Live classes, private sessions and financial safety

Community reservations are free; only authoritative verified room attendance spends a class token once. Stripe payment for a token alone does not create trainer earnings. Room tokens validate identity, role, booking, timing and eligibility. Ordinary attendees do not receive broad publishing or room-admin permissions merely for being authenticated.

New private installment bookings freeze the trainer's price and disclosed terms. A 25% booking deposit is credit toward the total. The remaining balance is collected only after verified two-party attendance at/after the session start. Audio/video access remains locked while payment or authentication is pending. The existing intent supports Stripe.js authentication/card replacement rather than creating a new charge on each retry or reconnect.

A trainer may approve one transfer of the original deposit to a same-trainer, same-total reschedule. Trainer cancellation/expiry supports a full unfulfilled-session refund or a consensual transfer; old fully paid bookings stay version 1 and must not receive new deposit/balance charges. Refund, dispute and transfer/reversal state is durable and idempotent. Private service earnings stay held until the implemented delivery-confirmation rules are met.

Ambiguous payment, refund or payout creation after the retained idempotency window requires provider reconciliation. Do not clear a job or issue a replacement charge/transfer blindly. Retain immutable provider IDs and reconcile Stripe before retrying financially ambiguous operations.

### Advertising, recordings and stores

The existing Bunny player was extracted into a reusable component without introducing another media provider. Ordinary public workouts retain water-break-only advertising. Measurement events do not mint earnings; a trusted settlement adapter must independently establish recognized paid sponsor revenue. Provider agreements, billing authority and approval remain external launch gates.

Recorded-class imports reuse the existing private R2, queue, LiveKit Egress and Bunny architecture, with durable retry/dead-letter handling and admin review. Private sessions are not automatically recorded. Actual provider recording, bucket permissions and transfer behavior still require staging verification.

Trainer-owned external stores and affiliate links remain available. Their existing 100% trainer revenue rule is unchanged. Future Tryumph-hosted merchandise is not activated by this work.

### Community, safety and notices

Trainer leaders choose public or private posts. Public trainer content may appear in discovery; member posts remain private to their Trybe. Comments and interactions require appropriate membership. Individual Trybe feeds remain scoped; the joined feed aggregates authorized content. No fictional trainers or invented engagement were seeded. Introductory prompts are explicitly attributed to Tryumph Gym.

Official public announcements, private trainer/member audiences, reports, moderation history, account restrictions/restoration and appeals are connected. In-app notices include existing credential stages (60/30/14/7 days and expiry), class changes, permitted friend activity and distinct local-day milestones. General signed-in activity is not represented as completed workouts.

### Trainer programs and exercise variations

Trainers can save drafts while filming, add title/description/cover/category/goals/equipment/difficulty and suitability notes, organize and reorder weeks/days/workouts/exercises, plan rest days, preview, and submit an immutable edition for independent review. Draft placeholders are allowed; publication requires the included primary workouts and demonstrations to be approved and available. Public listings disclose included available content.

Existing approved Bunny assets are referenced rather than copied for every program. Exercise variations support labels, descriptions, equipment, instructions, safety notes, an optional approved demo video and/or private reviewed image. Program images are immutable private uploads (JPEG/PNG/WebP, up to 5 MB). Baby-holding or postpartum labels never imply universal medical safety; clinician guidance and individual recovery remain necessary.

The member experience includes public details, free enrollment or one-time purchase, 30-day/90-day/lifetime access, weekly/day navigation, completion, progress, resume, and a paginated library. The follow-along player uses client-side work/rest timers. Changing demonstrations preserves elapsed time and the workout target. Saves occur at meaningful checkpoints rather than per-second server polling.

Purchased editions remain pinned when a trainer publishes edits or unpublishes a listing. Native order price, commission, access term, destination and edition are frozen. Checkout retries reuse the original pending order even if a new edition/price is published. Settlement checks Stripe identity, amounts and actual fees server-side; browser redirects do not grant access. Refund/dispute updates, repurchases and entitlements share a transaction lock. Refunds/chargebacks update access and corresponding transfer/reversal targets; an unrelated failed purchase does not revoke another legitimate program.

Premium video rows and raw paths are not exposed by anonymous/public playback APIs. A separate protected Bunny library and provider-security attestation gate are required. Signed video credentials are at most 15 minutes and bounded by access expiry. Image links are short-lived. These controls require actual unsigned CDN/iframe/download testing before relying on them in production. Existing public videos remain free outside a paid schedule; buying a program does not make a previously public asset exclusive.

Purchased program playback suppresses advertisements, including reused public videos. External checkout links do not automatically grant Tryumph entitlements; independently reviewed receipts can be recorded by an admin without booking external revenue into Tryumph's financial ledger.

Trainer and admin dashboards include program enrollment/sales/earnings metrics. Admin reports show native gross sales, refunds, actual processing fees, trainer/Tryumph allocations, held orders and client-reported usage. Bandwidth and infrastructure estimates are labeled as estimates; blank rate configuration means unavailable. They are not actual Bunny invoices, do not prove actual watched bytes, and never alter the trainer split.

### New: Trybe community polls

Polls are a supported `Poll` post type in the existing feed. Current verified trainers can create polls in their own coach Trybe; actual owners of registered non-trainer Trybes can create polls in theirs. Ordinary non-owner members cannot create polls. The existing hosted `trybes` registry is reused; it is not replaced or repopulated. A compatible empty registry is created only in an environment where it is absent. This feature does not invent owners or add a new Trybe-creation product.

Polls support a question, optional context, two to six distinct answers, one choice or a configurable multi-choice limit, optional expiry, and optional notification. Trainer polls can expose their question in public discovery. Voting still requires authenticated authorized membership; member-owned group polls stay private. Existing owner and ordinary-member joining behavior is preserved, with an additional checked policy for registered member communities.

One transactional ballot per member is enforced, with selected options restricted to that poll. Retries replace that member's selection rather than multiplying voter counts. A multi-choice ballot counts as one voter; percentages are per participating voter and can total above 100%. The zero-vote state remains finite. Ordinary members see result breakdowns after voting or after closure; creators and admins see aggregates. Raw ballots and individual voter choices are denied to clients, including admins. Members receive only their own selected option IDs.

Creators can edit an open poll before the first vote. A revision protects stale forms/ballots, and votes lock question, options, mode, selection limit and expiry. Creators/admins may close a poll without erasing ballots; admin closure requires a reason and is audited. Expiration is enforced server-side during reads/votes; there is no expiration cron. The browser does not poll results every second and performs one expiry refresh, plus explicit user refreshes/actions.

Polls reuse existing post reports, admin hiding and moderation history. Admins can inspect reported poll aggregates and close/hide reported polls directly. Parent deletion removes child poll records consistently with existing post deletion, while independent moderation history remains. Polls cannot be reassigned to another community or have their visibility silently changed through raw post edits.

Optional in-app poll notices use the existing notification system. Each member must enable **New polls in my Trybes** in Account/Studio notices; this preference defaults off. Delivery is deduplicated, excludes the author and unauthorized/opted-out members, skips hidden/closed polls, and links directly to the poll. A keyset-cursor job scans bounded batches through the existing five-minute maintenance handler. There is no new paid service or cron. Large fan-outs can span multiple maintenance runs. Notified polls are limited to one per Trybe per hour; creation is limited per creator per day.

Poll answers are research only: no automatic class booking, attendance promise, program product, recurring membership, Stripe charge, LiveKit permission or class token is created.

## 4. Where to use the features

| Route | Founder/trainer/member action |
| --- | --- |
| `/account` | Signup/login, profile, member programs, notices and poll preference; preserve existing auth callbacks. |
| `/studio` | Verified trainer uploads, Programs builder, existing classes/bookings/payouts/notices. |
| `/programs` | Program discovery and enrolled library; paginate instead of assuming the first page is all content. |
| `/programs/<actual-program-uuid>` | Public listing, confirmed enrollment/purchase, pinned schedule, workout playback/progress. |
| `/trainers/<actual-trainer-uuid>` | Trainer information, existing storefront and trainer-specific programs. |
| `/trybes?t=coach-<actual-trainer-uuid>` | Trainer's posts, programs and polls. Create a poll only in a Trybe you own. |
| `/trybes?poll=<actual-post-uuid>` | Direct authorized poll link, including notification links to older posts. |
| `/admin` | Existing safety/report center, program review/owner commercial controls and program sales/usage report. Poll moderation is in the existing safety center. |
| `/contact` | Contact requests use the configured founder sender/recipient; authenticated payment-support paths retain their checks. |

## 5. SQL decision table and safe order

**Never run every migration from `0000` on your existing hosted database. Never run both old baseline bundles.** `docs/launch/completion.sql` and `docs/launch/upgrade.sql` remain historical artifacts and are intentionally excluded from the downloadable active SQL appendices. Neither was safe unchanged against the supplied mixed hosted schema.

| Actual state | Safe next action |
| --- | --- |
| Original inspected October 27 schema restored into isolated staging, without reconciliation | Run read-only inspection/platform-binding checks, then `reconciliation/00_readonly_preflight.sql`. Require its guard to pass without weakening it. Run `01_stage_apply.sql`, then `02_validate_staging.sql` and confirmation. Only then apply `0058` and `0059`. |
| Foundation already reconciled through `0057`, verified against fresh staging metadata | Do not replay the original-snapshot foundation preflight/apply. Inspect module objects; apply missing `0058`, then missing `0059`, after review. |
| Program module `0058` already installed and verified | Do not replay it. Inspect and apply only missing `0059`. |
| Poll objects or program objects partially exist, or the actual schema differs from these known contracts | Stop; retain the error and fresh inspection. Reconcile differences additively before any further apply. The module guards intentionally refuse replacement/replay. |
| Migration history missing | This alone selects no path. Inspect columns, constraints, functions, policies, triggers, grants and platform bindings. |

The appendices include exact scripts with hashes, in this order:

1. `docs/launch/inspect-hosted-schema.sql` — read-only application metadata inventory, not account/payment/message data export.
2. `docs/launch/reconciliation/03_inspect_platform_bindings.sql` — read-only auth/event/publication facts outside the original export.
3. `docs/launch/reconciliation/00_readonly_preflight.sql` — exact original-snapshot staging guard; only for the matching unreconciled case.
4. `docs/launch/reconciliation/01_stage_apply.sql` — transactionally guarded foundation reconciliation; only for that matching case.
5. `docs/launch/reconciliation/02_validate_staging.sql` — foundation validation, including validation of the additive reviewer foreign key; this is not a read-only script.
6. `docs/launch/confirmation.sql` — earlier launch confirmation checks, after their required foundation is present.
7. `migrations/0058_workout_program_builder.sql` — one-time programs module; no backfill of purchases or invented media.
8. `migrations/0059_trybe_polls.sql` — one-time polls module; existing business rows and messaging policies preserved. The notification category check is broadened to retain old categories and add `poll`; existing preferences gain an opt-in boolean defaulting false.
9. Current read-only module postchecks, included in the download.

Both new module migrations are transactions. Apply each complete script. If a transaction fails and remains open, issue `ROLLBACK;`, save the exact error, and inspect rather than removing guards or deleting data. Do not rerun already committed modules. SQL Editor runs as a privileged role and cannot prove ordinary-user RLS. Follow the real-account tests.

The original schema comparison counted 785 reproduced application objects: relations 17 match / 28 differ / 18 missing / 2 hosted-only; columns 316 / 23 / 119 / 10; constraints 141 / 5 / 64 / 13; indexes 63 / 2 / 27 / 8; policies 65 / 5 / 75 / 24; triggers 12 / 0 / 12 / 2; routines 28 / 17 / 45 / 4. These were comparison findings, not instructions to replace every differing object. Stricter hosted credential grants, existing Trybes/comments, FK cascades, legacy equipment NULLs, existing accounts, requests, messages, videos and financial records are deliberately preserved. See the reconciliation findings reference for rationale and baseline fingerprints.

## 6. Provider and runtime configuration

Use dashboard secret stores. Do not paste secret values into chat, Git, public screenshots, this guide, `VITE_` variables or `.env.example`. Use separate staging/test credentials and an explicit independent HTTPS origin. Native program checkout stays disabled until sandbox acceptance and separate production authorization.

Core public/browser values are `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Server runtime uses `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and private `SUPABASE_SERVICE_ROLE_KEY`. The build and runtime must point to the intended same staging project. `APP_ORIGIN` controls independent redirect origins; Supabase Site URL and redirect allowlists must match. No Lovable hosting is required by the independent production code. Branch pushes still sync to the connected Lovable editor; that integration is not a production hosting dependency.

Stripe uses server-only `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; use only test keys first. Public `VITE_STRIPE_PUBLISHABLE_KEY` is for the existing-intent authentication flow. Register the actual staging endpoint `/api/public/webhooks/stripe` and required checkout/payment/refund/dispute/account events against the locked SDK API version. Validate test Connect transfer capabilities, fees, refunds and reversals. Do not switch to live keys as part of this guide.

Public Bunny configuration uses `BUNNY_STREAM_LIBRARY_ID`, private `BUNNY_STREAM_API_KEY` and `BUNNY_STREAM_TOKEN_KEY`, with provider embed authentication and allowed origins. Optional public thumbnails use `VITE_BUNNY_STREAM_CDN_HOSTNAME`. Program media adds separate `BUNNY_PROGRAM_LIBRARY_ID`, `BUNNY_PROGRAM_API_KEY`, `BUNNY_PROGRAM_TOKEN_KEY`, with `BUNNY_PROGRAM_MEDIA_VERIFIED=false` until actual unsigned iframe/HLS/download tests pass. Never mark that flag true solely because a signed embed renders.

Program commerce adds `PROGRAM_NATIVE_CHECKOUT_ENABLED=false` and `PROGRAM_TERMS_OWNER_ID=<actual-owner-admin-uuid>`. The owner records approved 500 basis points and a genuine terms reference in Admin. In staging only, enable the database commerce switch and runtime gate when payment/media setup is ready. Rates are frozen per order; future owner changes do not rewrite purchases. Optional estimates: `PROGRAM_ESTIMATED_GB_PER_HOUR`, `PROGRAM_ESTIMATED_USD_PER_GB`, `PROGRAM_ESTIMATED_USD_PER_1000_SESSIONS`; leave blank rather than inventing rates.

LiveKit requires `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` and the signed `/api/public/webhooks/livekit` endpoint. Test actual waiting-room, attendee, host, recording and shutdown behavior. R2/Egress uses `R2_S3_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_RECORDINGS_BUCKET`, private `R2_RECORDINGS`, and `RECORDING_IMPORTS`/dead-letter bindings from Wrangler. These names in source do not prove remote resources exist.

Recognized sponsor delivery/settlement uses the existing signed measurement and settlement adapter settings (`WATER_BREAK_EVENT_SIGNING_SECRET`, `AD_SETTLEMENT_WEBHOOK_SECRET`). A valid technical test is not a sponsor contract, provider approval or billing proof. Optional analytics/push settings remain optional and independent of Lovable.

Polls add **no environment variables, paid provider, payment configuration or new cron**. Apply the schema, refresh PostgREST's schema cache as needed, deploy only to an authorized staging target, and verify the existing maintenance handler can call `deliver_trybe_poll_notices`. Poll notification preferences default off; members enable them explicitly.

### Resend and the founder email

The requested founder address is **mackenzie@tryumphgym.com**. The existing contact sender/recipient code and `.env.example` use that address. Resend account creation, domain verification, SMTP saving, DNS changes, actual email sending/delivery and provider approval were not completed from this environment. The prior attempt to fetch the provider setup guide was blocked; verify the current provider instructions yourself before entering dashboard settings.

For an authorized staging contact setup, store a sending-scoped private `RESEND_API_KEY` in the Worker and set `CONTACT_FROM_EMAIL=mackenzie@tryumphgym.com`. Confirm From/To/Reply-To, durable sent receipt, message ID, actual mailbox receipt and bounce/delivery logs. Contact delivery and Supabase Auth SMTP are separate integrations.

For optional Supabase Auth SMTP, proposed settings to confirm against current Resend documentation are sender `mackenzie@tryumphgym.com` / Tryumph Gym; host `smtp.resend.com`; TLS port `465`; username `resend`; private API key as SMTP password. Preserve existing signup/reset/session logic and approved callback origins. Actual domain records must come from Resend. Do not replace Google Workspace root MX records, guess DKIM values, change production SMTP or migrate DNS without authorization.

## 7. Verification evidence and limits

The current verification table is appended by the guide generator from actual check logs. The program-builder checkpoint passed 255 tests across 37 files, typecheck, build, migration validation and lint with zero errors / 72 warnings. The initial co-running build/migration test pass had a five-second schema-inspection timeout; an isolated full rerun passed. Historical October 27 reports recorded 192 tests across 28 suites; these are historical counts, not additional unique tests to add to the current suite.

Database tests use actual isolated PostgreSQL/PGlite with Supabase platform schemas/roles emulated. The last hosted inspection was PostgreSQL 17.11; the local engine is PG18. Tests reconstruct the supplied application metadata and compare existing seeded data/policies. Provider orchestration uses mocks when stated. No test here proves current production data integrity, actual Storage HTTP enforcement, real JWT browser behavior, Realtime delivery, off-session authentication, live CDN restrictions, real transfers, recordings, email delivery or sponsor approval.

The new poll tests cover creator authority, member-owned registry reuse, ordinary member denial, blank/duplicate options, selection limits, private/public access, ballots/retries/changes, multi-choice totals, closure/expiry, immutable voted content, stale revisions, raw-ballot denial (including admins), reports/admin moderation, preference-aware notices, membership withdrawal, parent deletion and existing ordinary posts/comments/likes. UI tests exercise radio/checkbox voting, form submission, limits, zero votes, local expiry and moderation reasons. Feed tests check pagination and scoped likes/comments.

Useful local commands: `npm run typecheck`; `npm test`; `npm run lint`; `npm run build`; `npm run db:check`; `npm run db:types`; `git diff --check`. These do not require pointing `DATABASE_URL` at production. Do not regenerate/apply a historical baseline bundle as a shortcut for the reconciled staging path.

## 8. Real staging acceptance scripts

Use a verified trainer T, ordinary members A and B, and a separate admin O. Use real separate browser sessions and actual JWTs. Confirm old signup, friend messaging, trainer stores and existing financial records before and after migrations. Do not seed fictional activity in production.

### Core launch and existing functionality

- Sign up A and B, verify confirmation and password reset through the chosen staging mail provider, reload sessions and test signout/signin. Check independent origins and callback allowlists.
- Send/accept a friend request, exchange messages in both directions, refresh/reconnect, unfriend and confirm history remains. Check eligible trainer inquiry without friendship and trainer reply. Confirm unrelated strangers cannot message and blocks/restrictions apply. Admin must not browse unrelated DMs.
- Upload private credential evidence into T's own UUID folder. Reject other-folder, invalid MIME/oversize and replacement attempts. Independently review, expire, renew and verify current eligibility and history. Preserve older approved workouts.
- Upload/transcode/review an ordinary workout and exercise safety/equipment filters. Check no-equipment matching, all three discovery categories and exclusion of pending videos. Confirm no ads without break markers and no mid-set ads.
- With zero videos, a current verified trainer with eligible payouts can schedule/host a live after 0060. Test a $5 drop-in, reservation without debit, actual attendance debit once, reconnects, cancellation/refund, audience permissions and room shutdown. Verify real signed webhooks.
- Book a new private session at T's price, inspect the 25% deposit, waiting room and no balance on token issuance alone. Admit both people, verify the same 75% intent/SCA flow before media, reconnect and confirm no extra charges. Exercise one approved deposit transfer, trainer cancellation/expiry, refunds, delivery confirmation and payout reversals. Old version-1 paid bookings must not prompt another charge.
- Review official/public/private audiences, reports, restrictions and appeals, opt-in friend notices, credential reminders and local distinct-day activity. Verify Youth/Nutrition/Homeschool remain hidden.
- Confirm existing external stores still open independent checkout and no Tryumph commission/payment is introduced. Test recordings/queues/dead letters only with consent and sandbox providers.

### Programs

- T saves a filming draft without videos; incomplete content cannot publish. Reuse approved primary/demo videos, upload a private demo image, and have O independently review. Reorder weeks/days/workouts/exercises and save/reopen.
- Publish a free program and a paid test program. Check public included-content previews, profile/Trybe links, mobile layout, sharing and paginated discovery/library. A non-buyer must not receive the paid edition or raw premium media.
- Buy a 30-day program with A. Verify actual processing fee, frozen price/rate/access/destination and cent allocation. Retry checkout while T publishes an edited price; one original checkout/charge must remain. Replay webhooks and confirm one entitlement/transfer.
- Test 90-day and lifetime access; verify server expiry, repurchase, and an unrelated failed order not revoking legitimate access. Edit/unpublish and confirm A retains the purchased edition. Withdraw media/edition approval and verify moderation behavior/support path.
- Switch rich exercise variations while the timer runs; verify elapsed time and work/rest phases, pause/resume, close/reopen checkpoint, completion and no per-second network saves. Test Bunny seeking/looping on real devices.
- Confirm purchased playback is ad-free even when its primary video was public. Test unsigned iframe/HLS/MP4 denial, different-account/revoked/expired access, credential expiry and signed-link expiry at the provider.
- Test partial/full refunds, disputes, won/lost events, out-of-order delivery, concurrent refund/repurchase, duplicate requests and actual Connect reversals. Review held orders and estimated costs separately from revenue splits.

### Polls

- T opens their coach Trybe and creates a private poll, then a public-question poll. A real non-trainer registry owner creates one in their own group. A/B cannot create there; T cannot create in another trainer's group. Expired/unverified trainer creation must fail.
- A joins and votes once. Retry the same request; the voter count must remain one. Change selection. B joins and votes differently; compare exact aggregate totals. Try a multi-choice poll and enforce its maximum, duplicate-option rejection and per-poll option identity.
- Before voting, ordinary members cannot see option totals. After voting, their totals appear. At closure, eligible non-voters see final results. Non-members/public visitors cannot vote or obtain private choice breakdowns. Direct Supabase reads of ballot tables must fail even for an admin's normal authenticated JWT.
- Edit before any vote and test a stale edit/ballot revision. After voting, edits must fail and existing ballots remain. Test manual and timed closure, including a submission that waits across expiration. Browser times must match the viewer's time zone.
- Opt A into poll notices and leave B opted out. Create one notified poll; wait for the existing maintenance run. A receives one direct poll link, T/B/non-members receive none. Retry fan-out; no duplicates. Leave the Trybe or hide/close the poll before delivery and confirm no new notice.
- Report a poll, open the report as O, review its aggregate, close with a reason and hide it. Verify audit history, feed removal and no ballot-identity access. Delete an owned parent post and verify child removal. Check existing ordinary posts/comments/likes, joined/discovery feeds and older-poll notification links.
- Confirm no vote creates a booking, subscription, class token, LiveKit permission, program product or payment.

## 9. Operations, rollback and records to keep

Keep the chosen migration case, original inspection export/hash, database/Storage backup identity, SQL script hashes, applied timestamps, actual error messages, real-account acceptance results and relevant provider request/event IDs. Never record private secrets or raw wellness/DM data in this guide. Keep a dated signed-off staging runbook and obtain production authorization after reviewing results.

The existing five-minute maintenance handler performs eligibility, attendance/payment, refunds, room closure and the new bounded poll-notification work. Existing payout reconciliation uses the existing admin workflow. Inspect failures, ambiguous operations, dead-letter queues and provider state; source bindings alone do not prove scheduling/resources are active.

On SQL failure, retain transaction rollback and inspect the mismatch. After a successful additive migration, prefer pausing affected feature gates and preparing a reviewed forward fix. An old app build alone is not a safe financial rollback. Restoring a backup after newer provider events requires a separately authorized incident procedure and payment reconciliation. Do not wipe accounts, requests, messages, credentials, videos or financial history to make a migration pass.

## 10. Source references and change inventory

The download adds the actual branch commit, changed-file inventory and current validation log summaries at generation time. Repository references:

- `docs/launch/CODEX_HANDOFF.md`: original engineering assignment and launch business requirements; a task definition, not evidence of production acceptance.
- `docs/launch/FOUNDER_HANDOFF.md`: historical earlier launch work and provider acceptance scripts. This consolidated guide supplements its October 27 snapshot.
- `docs/launch/reconciliation/findings.md`, `validation.md`, `object-comparison.json`, `sources.json`: actual hosted-schema comparison, preserved exceptions, tests and source fingerprints.
- `docs/launch/RESEND_SETUP.md`, `CONFIGURATION.md`, `INTEGRATION_TESTING.md`: provider setup and earlier integration boundaries.
- `migrations/0058_workout_program_builder.sql`: programs, media scope, editions, purchases, access, progress, payouts, private images and usage.
- `migrations/0059_trybe_polls.sql`: poll post/option/ballot/choice/job structures, private aggregates, revision/closure rules, owner registry compatibility, membership join and notification preference/category additions.
- `src/components/TrainerProgramBuilder.tsx`, `ProgramExerciseEditors.tsx`, `ProgramDetail.tsx`, `ProgramStepPlayer.tsx`, `ProgramAdmin.tsx`, `ProgramFinancialReport.tsx`: program UI and review/report integration.
- `src/lib/programs*`, `program-media.server*`, `program-payments.server*`, `use-program-clock.ts`, existing webhook/refund/transfer/payout integration: program server/business rules and tests.
- `src/components/TrybePoll.tsx`, `src/lib/polls*`, `use-trybe-polls.ts`, `community.ts`, Trybes route, `AccountNoticeCenter`, `AdminSafetyCenter`, existing maintenance: connected polls, paginated feed and existing infrastructure reuse.
- `src/test/*program*`, `*poll*`, `schema-reconciliation.test.ts`, `launch-security.test.ts`, `launch-completion.test.ts` and related component/library tests: executable local evidence, with provider mocks/emulation where documented.

Working code is reviewable on the development branch. No feature is represented as verified production behavior merely because its interface, migration or mocked test exists.
