# Tryumph Gym


Independent React 19 / TanStack Start application for Cloudflare Workers, with Supabase, Bunny Stream, LiveKit and Stripe Connect integrations.

## Development

Use the existing checkout. Each Codex cloud task is already isolated; do not create a worktree unless requested.

Node 22.18 or newer is required. The cloud environment was validated with Node 24.19.0 and npm 11.9.0.

```sh
npm ci
cp .env.example .env.local
npm run dev -- --host 127.0.0.1 --port 5173
```

Supply the **public** Vite values from the existing `wrangler.jsonc` configuration in `.env.local`. Keep server credentials in private runtime bindings (`.dev.vars` for local Wrangler), never in `VITE_` variables. Do not overwrite existing configuration files.

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm run db:check
```

`db:check` runs all ordered SQL migrations in an isolated PostgreSQL engine. It never connects to Supabase. `db:types` regenerates TypeScript database contracts from that isolated schema. ESLint checks code correctness separately from formatting; `npm run format` is optional and should not be used for broad unrelated changes.

The local app can start without private provider credentials. Real directory data, account operations, playback, checkout, live sessions and recordings require their corresponding services. Local page rendering does not establish production readiness.

## Launch review

- [Implementation and verification report](docs/launch/IMPLEMENTATION.md)
- [Ordered Supabase SQL plan](docs/launch/SQL_PLAN.md)
- [Runtime variables and provider setup](docs/launch/CONFIGURATION.md)
- [End-to-end verification checklist](docs/launch/INTEGRATION_TESTING.md)

Work belongs on `codex/tryumph-january-launch`. Do not merge, deploy, execute hosted SQL, change DNS or process real payments without explicit authorization. Existing history remains intact for the connected source editor; the production app does not depend on Lovable hosting.

