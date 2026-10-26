# Tryumph Gym release readiness (2026-10-26)

This is a consolidated source snapshot, NOT a certified production release.

## Confirmed code changes in this snapshot
- Worker runtime bindings are read directly in key server modules (Stripe, LiveKit, Supabase admin/auth, cron and moderation).
- Studio live-class unlock now checks both five approved videos and current verified CPR.
- Trainer profile links to the account photo uploader.
- Trainer store rejects non-HTTP(S) external product and image URLs.
- Public trainer API no longer exposes detailed database diagnostics.

## Must complete before taking real payments or onboarding real trainers
- Apply and verify the live-session database trigger from the companion SQL provided in chat.
- Investigate the failing public trainer API certification query on the actual Workers deployment.
- Verify certificate storage policies and admin review, expiration, renewal and revocation.
- Verify Bunny signed playback, upload and deletion authorization.
- Replace remaining demo trainer booking data with verified real trainer data.
- Configure and test Stripe checkout, webhooks, refunds, idempotency and Connect payouts.
- Verify LiveKit token permissions, streaming, recordings and scheduling.
- End-to-end test Trybes, preferences, filtering, mobile layouts, password reset, profile photos and trainer store.
- Ensure launch scope hides nutrition, homeschool, youth and ad-revenue features where appropriate.
- Only then connect tryumphgym.com to the Worker; preserve Google Workspace DNS records.

This project should not be represented as fully tested or launch-ready based solely on a successful build.
