# Tryumph Gym — certification schema alignment

Matched the supplied `public.certifications` column export without creating or altering any tables.

- New uploads store their private bucket object key in `document_path` rather than `note`.
- Admin document viewing uses `document_path`, with a fallback for earlier submissions that stored a path in `note`.
- Admin approval writes `verified_at` and `verified_by`; rejection clears those verification markers.
- Supabase TypeScript certification types now include all four additional nullable columns.

## Not yet verified

The supplied export only describes public table columns. It does not establish whether RLS policies, the private storage policies, `has_role`, authentication, or the other tables used by the application are deployed and functional. This patch has not been live-tested. Do not run bundled migration scripts blindly against the existing Supabase project.
