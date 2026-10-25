# Auth migration checkpoint

- Account page Google sign-in now calls the independent Supabase OAuth API, not Lovable Cloud Auth.
- Signup no longer treats an unconfirmed email as an authenticated session.
- Signup records requested_role in user metadata only; do not grant trainer/admin privileges based on user-editable metadata.
- Configure Google OAuth in Supabase Auth providers and set allowed redirect URLs for the deployed origin.
- Remaining blockers: Lovable Vite build plugin, preview-specific session storage, store auth synchronization, server session verification, and complete end-to-end testing.
- Do not deploy to production yet.
