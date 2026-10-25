# Tryumph adult fitness launch changes

## Implemented in this exported code
- Removed Nutrition from desktop and mobile navigation; visiting `/nutrition` now shows a coming-later message instead of the unfinished product. Nutrition code remains for future use.
- Removed Homeschool PE from public category choices and preview/uploaded workout lists, and removed the homeschool shop teaser. Youth-related backend functionality is retained for future rollout.
- Coach Trybe deep links now isolate the coach community navigation and posts; the My Trybes feed displays posts from joined communities only.
- Added shared goal options to onboarding, profile editing, and coach uploads, including marathon, functional fitness, weight loss, and core strength.
- Added goal tags and filtering for uploaded workouts and the on-demand library.

## REQUIRED before deploying
1. Apply `drizzle/migrations/0018_trainer_video_goals.sql` to the connected database. Uploads with goals will fail without the `goals` column. Confirm this migration is compatible with your Lovable Cloud deployment workflow.
2. Restore environment configuration securely in your hosting environment. `.env` was intentionally excluded from this ZIP.
3. Install dependencies and run `npm run build`, `npm run lint`, and `npm test`. Dependency installation could not complete in this environment, so the changes are **not build-verified**.
4. Test logged-in Trybe membership, deep-link navigation, uploads, goal persistence, filters, mobile nav, and the live/Stripe/LiveKit flows on a staging deployment.
5. Note that hiding navigation and routes is a launch presentation change, not authorization/security protection. Existing database policies and permissions must still be reviewed before launch.
6. Placeholder trainers, workouts, and demo metrics remain in the project. Review public demo wording so nobody mistakes sample data for real traction.

Do not replace the live deployment until these checks pass.
