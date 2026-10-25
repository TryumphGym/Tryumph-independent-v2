TRYUMPH GYM - BUNNY STREAM TEST INTEGRATION

Replace these FIVE files in GitHub Tryumph-independent-v2 using the same paths:
  package.json
  src/routes/api/bunny-upload.ts (NEW FILE)
  src/routes/studio.tsx
  src/routes/on-demand.tsx
  src/lib/videos.functions.ts

Cloudflare runtime variables required:
  BUNNY_STREAM_LIBRARY_ID (Text)
  BUNNY_STREAM_API_KEY (Secret)
  SUPABASE_URL (Text)
  SUPABASE_PUBLISHABLE_KEY (Text)

IMPORTANT: Your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY build variables are NOT replacements for server-side SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Add the server-side variables if absent. No Supabase service role key needed for the new Bunny flow.

This version uploads videos DIRECTLY from the trainer browser to Bunny with resumable TUS uploads and a short-lived server-generated signature. The Bunny API key stays on the server.

For testing: use a short MP4 first. After upload, the trainer_videos table must have an entry with path bunny:<libraryId>:<videoId>. On-demand playback uses Bunny's iframe player. Bunny processing can take a few minutes.

KNOWN LIMITATIONS / BEFORE PUBLIC LAUNCH:
- Bunny iframe playback does not yet integrate the existing Tryumph water-break ad timing controls. These still work on legacy HTML5 videos. A later HLS-player integration is needed for timed ad breaks on Bunny videos.
- Removing a Bunny video from the studio deletes its Supabase row but does NOT delete it from Bunny. Delete orphaned videos manually in Bunny until a secure server-side delete handler is implemented.
- Newly uploaded videos may not be playable until Bunny completes encoding.
- Bunny's default playback may be public unless library token authentication is configured. Do not use this version for private/premium content.
- The five-video unlock currently counts saved rows, not Bunny processing/approval state.
- No end-to-end deployment test has been run. This is a test integration, not a verified production launch.

Do not change client.tsx (working hydration fix).
