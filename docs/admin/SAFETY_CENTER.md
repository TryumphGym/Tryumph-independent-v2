> October 27 follow-up: see [the founder handoff](../launch/FOUNDER_HANDOFF.md) for the current implementation, SQL sequence and verification boundaries. The historical descriptions below are retained as context; use the handoff where they conflict, including deposits, attendance and messaging policy.

# Safety Center rollout — staged, not live

The owner safety center displays profiles, recent Trybe posts (including private posts for moderation if admin RLS allows), comments and incoming reports. It supports reports on **any user** (not just trainers), trainers, posts, comments and users encountered in accountability chats. The interface supports case triage and Trybe post hide/unhide. Private chats cannot be browsed by administrators.

The existing /admin admin check is only a navigation guard. **Supabase RLS is the mandatory enforcement boundary.** Reports will not save, and admin views may be incomplete, until the dedicated `content_reports` table and policies are reviewed and created via Supabase SQL Editor.

Do not deploy before:

1. Apply reviewed additive SQL and test RLS as a regular member, trainer, admin, and unauthenticated user. Restrict report inserts, admin updates, and all admin-only reads at the DB level.
2. Test the reporting control from a Trybe post, comment, trainer Trybe, user post, friend and chat partner. A user must never report a different sender on someone else's private conversation.
3. Test hide/unhide as admin; existing `moderate_trybe_post` may not authorize admins from outside that Trybe and requires an audited admin action if so.
4. Audit availability of existing public.profile rows for all auth.users; users listing is not a definitive Auth account list. Add server-side, admin-authorized Auth pagination and account lifecycle tools separately.
5. Add case action logging, reversible account restrictions/suspensions, appeal and escalation flows, comment moderation, and notifications before claiming full moderation readiness.
6. Reconcile privacy terms and retention standards. **Do not grant automatic admin read access to private messages.** A separate participant-driven evidence-report workflow should be considered.

No production database migration or deployment has been performed.
