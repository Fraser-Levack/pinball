# Deploying

The site runs in two places that share one Supabase project:

| | Cabinet (your computer) | Public site (e.g. Vercel) |
|---|---|---|
| Play, leaderboard, browse apps | yes | yes |
| Build with Claude Code, pachinko | yes | no |
| Share builds, add apps by hand | yes | no |

Builds run Claude Code on the cabinet and are uploaded to Supabase when shared, so they show up
on the public `/apps` straight away.

## Public site (Vercel)

1. Push this repo to GitHub and import it in Vercel (framework: Next.js, defaults are fine).
2. Project Settings → Environment Variables: add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   Do **not** add `NEXT_PUBLIC_LOCAL_BUILDS`.
3. Deploy.

## Cabinet

1. Install Claude Code and log in (`claude` in a terminal).
2. Copy `.env.example` to `.env.local`, fill in Supabase, and keep `NEXT_PUBLIC_LOCAL_BUILDS=1`.
3. `npm run build && npm start`, then play at http://localhost:3000.
   (`npm run dev` works too; restart it after changing `.env.local`.)

Build routes also refuse anything not addressed to `localhost`, so even with the flag on they can
only be used from the cabinet's own browser.

## Before going public

`/api/scores` accepts any score from anyone, so a visitor could post a fake one. Fine for a
hackathon; add rate limiting or a server-side check before relying on the leaderboard.
