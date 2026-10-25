# Independent deployment checkpoint

Changes: replaced Lovable Vite configuration with standard TanStack Start / Cloudflare Vite plugin; removed Lovable OAuth SDK in favor of Supabase; removed Stripe fallback redirect to Lovable.

**Not yet verified:** dependency installation, production build, Cloudflare deployment, server runtime compatibility, auth sessions, payments, LiveKit and video. Do not use for real payments until verified.

Install with `npm install`, then `npm run build`. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from `.env.example`. Set APP_ORIGIN and server-only keys privately on host. Check Cloudflare Vite plugin compatibility with the installed TanStack Start version.

Other Lovable-specific code remains (preview auth storage, telemetry, AI gateway). These require audit before claiming fully Lovable-independent.
