# Expired trainer credential booking and payout policy

**Status: approved product design / implementation pending. NOT a live automation.**

## Scope
- A trainer must maintain all **required current verified** credentials (including CPR/AED and any other program-required credentials) to upload/publish NEW content, accept NEW 1-on-1 bookings, or create/host live classes.
- Prior approved on-demand content stays available unless separately moderated for safety reasons.
- Check eligibility server-side at booking availability, checkout/hold creation, payment confirmation, live token issuance, and private-session room/token issuance. Never rely on disabled buttons. Credential renewal must be verified, not merely uploaded.
- Prevent payouts for a canceled or unfulfilled session, using the existing refund/reversal accounting mechanisms.

## Time-based policy
1. Send expiring-soon notices at 60, 30, 14, and 7 days before the **credential's actual expiration**, plus on expiration; deduplicate notices.
2. On loss of eligibility, prevent new paid bookings and sessions, and mark future existing private sessions `credential_hold`. Preserve paid booking history and audit events. Notify trainer and each affected paying member.
3. Give each member a clear choice: full refund, or retain a time-limited hold awaiting renewal. Do not silently reschedule or convert a session to another trainer.
4. No session may start during a hold. If the originally scheduled session time arrives before verified renewal and mutually confirmed rebooking, queue an **automatic full refund** promptly; do not prolong funds holding. Allow immediate member-requested refunds earlier.
5. Once credentials are verified, restore eligibility, but do not automatically resurrect canceled/refunded appointments. A retained hold needs explicit member consent for a new date/time, and a fresh booking-eligibility check.
6. Notify the member of refunds and their status, log moderation/credential changes, and maintain operational visibility of refund errors until resolved.
7. Exempt already-delivered sessions from automatic reversal just because credentials expired later; disputes and safety investigations follow separate policies.

## Implementation integration points
- Credential eligibility RPC/database trigger or server function, used consistently by Bunny upload ticket, on-demand publishing, class creation/start, private booking reservation/Stripe checkout, and video-room access.
- Scheduler that runs near expiration and before every booking/session; durable outbox + idempotent refund job with Stripe reconciliation.
- New booking lifecycle fields/statuses and member/trainer notifications. Adapt existing `cancel_private_session`, `processRefundJobs`, `MemberSessions`, and payout reversal logic rather than doing direct untracked Stripe refunds.
- Credential verification history: current verified replacement of an expired credential should restore access without unnecessarily blocking the trainer for an old expired record.
- Explicitly test race conditions (credential expires between purchase and join), time zones, overlapping certificates, failed refunds, repeated events, and delayed verification.

## No change to live operations yet
This policy document is not an implemented hold engine, eligibility enforcement, user notification service, or refund automation. SQL and migrations must be separately reviewed against the live Supabase schema before deployment.
