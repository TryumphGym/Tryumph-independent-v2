<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- App state (wallet, reservations, profile, posts) lives in src/lib/store.tsx and is saved on the device; swap it for the cloud when real accounts are added — keeps phase 1 working without a server.
- Private Trybe ids are listed in both src/lib/data.ts (isPrivateTrybe) and the can_see_trybe() database function; keep them in sync — the database is what actually hides posts.
- Waitlist answers live with each cloud signup; shared formatting in src/lib/waitlist.ts keeps Admin and CSV exports consistent, and notification consent is collected separately from sending emails.
- Workout preferences live in the existing profile and extra fields; shared browser-safe matching applies them to preview and uploaded On-Demand workouts so the two libraries stay consistent.
- Fitness goal labels and scoring are shared in src/lib/fitness-goals.ts; upload goal tags use the third pipe-separated equipment metadata segment (gear | safety | goals), preserving existing storage and gear/safety parsers.
- Launch visibility uses src/lib/launch.ts without deleting paused offerings; Trybe feed scoping uses src/lib/trybe-feed.ts and route search selects standalone groups.
- Root server.ts forwards to src/server.ts; keep the SSR wrapper only in src/ so Nitro's root entry and TanStack's source entry share valid error-handler imports.
