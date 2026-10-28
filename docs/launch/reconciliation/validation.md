# Reconciliation validation — October 27, 2026

All commands below ran locally on `codex/tryumph-january-launch`. No hosted Supabase SQL or provider operation was executed.

| Command | Actual result |
| --- | --- |
| `npm run db:reconcile:compare -- <supplied CSV>` | 978 rows parsed; matching completion row; per-object report generated against migrations through `0056` |
| `npm run db:reconcile:build` | Seven reviewed migration sources, 785 snapshot fingerprints, source/artifact SHA256 manifest; SQL generated without hosted access |
| `npm test` | **192 tests / 28 suites passed**, none skipped |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; existing `inputValidator` deprecations, bundle/chunk and CSS sourcemap warnings remain |
| `npm run lint` | Passed: **0 errors, 75 existing warnings** |
| `npm run db:check` | All ordered migrations through `0057` applied to isolated PostgreSQL |
| `git diff --check` | Passed |

The reconciliation suite includes 16 tests. It reconstructs the actual application metadata, including hosted column ACLs, manual inquiry/announcement/identity policies and triggers, extra Trybe tables, FK cascades, nullable equipment and the confirmed postgres/public maintenance defaults. Before seeding, it asserts all 785 application definitions/grants match the supplied export. Only Supabase platform schemas/roles are emulated; hosted business rows are never loaded.

Tests verify preservation of seeded profiles, incoming requests, accepted/unaccepted friendship records, messages, credentials, videos, legacy booking/payment/earnings/wallet records and trainer stores. Legacy paid bookings remain version 1 without balance operations; new deposits settle once with no premature earnings. The manual inquiry policy keeps its name and uses the checked helper; its redundant permissive replacement is absent. Actual RLS tests allow accepted-friend messages, eligible inquiries/replies and intended audiences, and deny spoofed senders, unrelated strangers, blocks, unaccepted unilateral relationships, unauthorized acceptance and admin DM browsing. Unfriend retains conversation history. Official publishing works with the hosted and new triggers; public readers see approved videos while pending content stays private. Client truncation/payment-attendance RPC access is denied and strict credential column ACLs remain.

Snapshot drift and replay refuse before applying changes. An intentionally injected profile update causes preservation assertions to abort the entire transaction; rollback restores the original rows and removes newly created objects. Source and generated-artifact hashes are checked by tests. Parser tests reject missing/mismatched completion, duplicate objects and truncated CSV. Four additional inspection tests exercise read-only metadata collection, absent optional objects, shadowed builtin names, overloaded functions and raising RLS history policies.

The two original bundle defects are reproduced in isolated tests: `upgrade.sql` fails when attempting to remove the hosted video-review parameter default; `completion.sql` commits but official publishing fails under the existing announcement trigger. The reconciled path preserves that default and fixes trigger compatibility.

**Not verified:** actual hosted counts/orphan/status/wallet consistency; an independent Supabase restore with original data; real ownership/Storage DDL permissions; Storage MIME/size enforcement over HTTP; auth/event trigger bindings, PostgREST schema refresh, real JWT/browser and Realtime delivery; email/Resend, Stripe, LiveKit, Bunny, recordings and ad approval. SQL/provider lifecycle tests use isolated fixtures or mocks where stated, not real charges, rooms or emails. The local engine is PG18/PGlite while hosted is PG17.11; deparse or platform differences must be reviewed on real staging, never bypassed.

Follow [findings.md](findings.md) for the exact staged sequence and rollback boundaries. Do not call this production-tested or launch-ready.
