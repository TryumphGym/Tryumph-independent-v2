# Cloudflare TanStack Start build layout correction

The previous version kept application source at repository root while TanStack Start's route generator expected `src/routes`. The earlier `srcDirectory` and `tsr.config.json` adjustments did not correct the server manifest. This revision moves the application source into `src/`, keeping relative imports intact, and uses TanStack Start's default source layout. The public assets, Supabase/migration files, and Cloudflare configuration remain at the repository root.

This package has **not** been verified with a successful production build in this environment. Upload the full project content, not just two files, because the source directory was reorganized. Do not commit `.env` or secrets.
