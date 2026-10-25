# Certification integration changes

- Trainer submissions now require a signed-in user and a PDF/image document (max 10 MB).
- Files are uploaded to the existing private `trainer-certificates` bucket under `<auth.uid()>/<random UUID>.<extension>`.
- Existing `certifications` table is reused; its `note` text field stores the private object path. No new SQL or tables are introduced.
- Admin verification/rejection continues to use the existing `certifications.status` workflow; admins can open a 60-second signed document URL.
- The trainer list reads persisted certifications for the signed-in user, not just browser state.
- `.env` was intentionally excluded from the output because it contains project credentials. Copy `.env.example` to `.env` and supply **your new** Supabase URL and publishable key. Never put a service-role key in `VITE_` variables.

**Schema assumption:** The target Supabase project must have the existing `certifications` table with `user_id`, `trainer_name`, `name`, `credential_id`, `expires`, `note`, and `status` columns and the private bucket/policies you already configured. If your newly created certification table uses a different name or columns, this adapter needs to be mapped to that schema.

**Not yet verified:** A live end-to-end upload and admin review against your new project requires your project configuration and accounts; no live database access was performed. Other features still use their original backend code and have not been fully migrated in this patch.
