# One-on-one payment on attendance — implementation plan

**Status: desired product behavior, NOT implemented/deployed.** The current server requires a `paid` row in `private_session_access` before a private LiveKit token can be issued. Current client booking and Stripe paths must be migrated together to avoid broken reservations, unpaid access, double charging, and conflicting refund logic.

## Product contract
1. Reserving a one-on-one books the trainer's slot and securely saves the member's reusable payment method via Stripe SetupIntent / supported Checkout setup flow with appropriate consent. **Do not charge at booking.** Never store raw card numbers in Supabase. Clearly disclose the price, payment trigger, cancellation policy, and whether an off-session charge may occur.
2. Before join, enforce current required trainer credentials and booking validity server-side. Trainer and member can reach a controlled waiting-room state; no full session access yet.
3. On verified *both-present* event, create/confirm a Stripe off-session-capable PaymentIntent with durable idempotency keyed to the unique private booking. Treat asynchronous payment failures and required authentication as an explicit pending state. Start the paid session only after Stripe confirms success; avoid charging on client-side Join clicks, page reloads, or forged webhook calls.
4. If credentials expire first, hold the booking, block new bookings and session start, notify both parties, and let the member cancel or select a new date after trainer re-verification. With no payment yet, no refund is needed.
5. Member no-show, trainer no-show, inability to authenticate payment, cancellations, and late arrivals need published rules and an auditable lifecycle; do not silently charge for unrendered services. Hold the slot, release it when policy allows, and keep payment-method retention/deletion controls.
6. Record settlement, trainer 90% share (after processing fee), Tryumph 10%, payouts, disputes and reversals only from trustworthy Stripe results; test partial failures and duplicate events.
7. If the same member enters a paid room more than once, never bill twice. If both parties are present but payment fails, do not deliver an unpaid session unless explicitly allowed by a documented policy.

## Existing integration points
- `src/lib/live-access.server.ts` requires `private_session_access.status='paid'`; must support a secure waiting room + verified payment state transition.
- `src/lib/live-token.server.ts` currently delegates to access logic. Do not grant full audio/video session access before verified payment.
- `src/components/SessionJoin.tsx` is merely a join button; do not equate a click with verified LiveKit attendance.
- `src/lib/session-management.functions.ts` and `src/components/MemberSessions.tsx` currently assume paid sessions and cancellation/refund processing.
- Stripe session creation, webhooks, room presence, hold-expiration scheduler, and schema migrations must be adapted together after testing against the real schema.

## Release gate
Migrate safely with explicit versioning of existing already-paid bookings. Do not retroactively attempt a second charge on them. Launch on staged users with tested Stripe test-mode scenarios before deploying.
