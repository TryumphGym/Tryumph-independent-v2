BUNNY CLOUDFLARE RUNTIME FIX

Replace exactly these two files in your GitHub repository, preserving folder paths:
 src/routes/api/bunny-upload.ts
 src/lib/videos.functions.ts

Do not change client.tsx or your existing variables. Commit, deploy, then retry a short upload.

Fix: reads Cloudflare runtime env directly and passes the trainer JWT to Supabase profile lookup.

This patch has not been verified with a deployed Cloudflare build.
