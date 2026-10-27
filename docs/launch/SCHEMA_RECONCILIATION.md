# Hosted schema reconciliation — October 27, 2026

The supplied **978-row export is complete and compared** with draft PR #2 at `3f60ba0`, through migration `0056`. This is a mixed database. Missing history did not select a baseline. **Do not run either old bundle unchanged.**

Read [the findings and exact staging sequence](reconciliation/findings.md). The [per-object inventory](reconciliation/object-comparison.json) covers relations, columns, constraints, indexes, functions, triggers, grants and policies. The [new staging transaction](reconciliation/01_stage_apply.sql) fingerprints all 785 inspected application objects, repeats data preflight and verifies original public records remain unchanged. It has been tested only in isolated PostgreSQL.

Key fixes reconcile the manual inquiry policy, existing announcement trigger, mutual accepted-friend contract, missing launch objects and unsafe client maintenance grants. Stricter column permissions, pending requests, real Trybe IDs, manual FK cascades, optional video-review RPC default and paid legacy bookings are preserved. No purchase or charge is backfilled.

Start with [read-only preflight](reconciliation/00_readonly_preflight.sql) on an independent staging restore. Actual hosted data counts remain unknown. [The platform follow-up](reconciliation/03_inspect_platform_bindings.sql) captures auth/event trigger bindings and publication definitions read-only. Review [validation boundaries](reconciliation/validation.md). No hosted SQL, deployment, merge, DNS or live payment action was performed.
