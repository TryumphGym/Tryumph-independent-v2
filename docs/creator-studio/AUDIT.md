# Creator Studio audit — November 4, 2026

Baseline: `579f6be`, existing `codex/tryumph-january-launch`. This is an enhancement, not a replacement. The hosted catalog last supplied is the 978-row October 27 export; current ordered migrations reconstruct the reconciled database locally. No fresh hosted SQL or business-data access is available. Production schema compatibility still needs a fresh read-only inspection; missing migration history never chooses a baseline.

| Area | Existing implementation | Work in this brief |
| --- | --- | --- |
| Identity/roles | One Supabase identity, protected persisted profile role, verified trainer credentials; Studio currently uses member shell and eight tabs | Dedicated 12-section Creator Studio; role-aware landing and presentation-only member switch, no role mutation |
| Subscriptions | Optional versioned offers, 90/10 after real fees, recurring Stripe/webhooks/paid periods/cancellation/refunds/disputes and separate payout ledger | Recommended $29.99 and configurable bounds; included scheduled lives and explicitly configured program access |
| Live | Scheduled $5/token classes; signed presence debit, limited attendee tokens, recordings/review/shutdown | Subscription authorization before payment/token debit; spontaneous subscriber-only rooms; bounded revocation; latest brief restores five approved videos |
| Programs | Free/native/external PDF/video programs, immutable reviewed editions, separate purchases, progress, variants/timers and protected files | Members-only access and explicit paid-program subscription benefit, PDF completion and aggregate progress analytics |
| Content/community | Approved Bunny uploads, metadata editing, public/subscriber/early-release video, Trybe posts/photos/moderation/store | Reuse and organize in Studio, strengthen metrics/comment management |
| Analytics/notices | Lifetime/current counters, program usage/checkpoints, message read controls, private notice center | Date-scoped aggregate business dashboard, event history from rollout, real activity notifications, no fabricated historic views or growth |
| Search demand | No application search-demand collection; PostHog is optional and has no authorized trainer-cohort/supply aggregation | Allowlisted asynchronous tracking, server-counted supply, privacy thresholds, retention and trainer-only aggregates |
| Spotlight | Sponsor creative management and community session/frequency/receipt tracking exist, but no paid discovery placement allocator or trustworthy attribution | Reuse taxonomy/ownership/admin patterns; draft/test configuration only, payments/fulfillment unavailable |
| Business inquiries | Fan/member and friend messages work; no separate partnership inbox | Private independently scoped inquiry pipeline/statuses with anti-spam and notifications; no friendship or message grants |
| Perks/School | Missing | Admin-managed verified-trainer offers and audience-aware tutorial CMS; no invented active offers; incomplete tutorials remain drafts |

## Financial/access treatment, documented before implementation

Existing commercial approval remains: subscriptions trainer 90% / platform 10%, native hosted program sales 90% / 10%, private coaching 90% / 10%, paid live drop-ins 50% / 50%. Use actual settled USD processing fees first, then integer-cent trainer floor and platform remainder, before hosting costs. Separate Stripe Billing/Connect charges remain operating costs to reconcile. No new rate is invented or activated.

Subscription receipts are unique by real invoice/payment intent. Related refunds are monotonic; refunds/disputes suspend that receipt's access and recalculate/reverse only its related transfer target, with persisted provider identifiers/leases/idempotency keys. Cancellation preserves legitimate paid access until its paid period expires. Paid program purchases remain independent; their historical edition, expiry, refund and payout records remain intact. A separately valid explicitly included subscription can authorize the same program without restoring or falsifying a refunded purchase.

Included subscriber attendance creates **no** $5 charge, token consumption, live earnings or separate split. Non-subscribers retain the existing $5 attendance-backed flow. A paid checkout already created before a member becomes a subscriber must be reconciled, not charged again. Membership payments never mint wallet tokens. Subscriber-only programs must use protected approved media and private files. New program subscription benefits default off for historical paid editions.

The latest brief explicitly requires five approved videos for both live types, overriding the November 2 no-quota requirement. This change must be reviewed on staging, especially previously scheduled classes whose trainers no longer qualify; no existing historical row or financial decision is rewritten. All required current credential checks remain. No production migration, deployment, merge, DNS change, email, real charge/refund/transfer or provider activation is authorized by this brief.

The founder’s November 4 update supersedes the brief’s proposed 95/5 program rate: new hosted PDF/video/mixed program sales use 90/10. Historical orders keep frozen terms. Spotlight is sequenced after core Studio; its proposed package prices are configurable tests and never constitute launch approval.
