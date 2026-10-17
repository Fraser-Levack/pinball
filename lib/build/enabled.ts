// Building with Claude Code only works on the computer running the game (the "cabinet"): it
// starts the claude program there and writes into its build folder. A public copy of the site
// (e.g. on Vercel) leaves this off, so it hides the build controls and its build routes refuse;
// visitors still play, see the leaderboard and browse shared apps from Supabase.
//
// Set NEXT_PUBLIC_LOCAL_BUILDS=1 in .env.local on the cabinet. NEXT_PUBLIC_ values are baked
// in by `next build` / `next dev`, so restart or rebuild after changing it.
export const BUILDS_ENABLED = process.env.NEXT_PUBLIC_LOCAL_BUILDS === "1";

export const BUILDS_OFF_MESSAGE = "Building with Claude is turned off on this copy of the game.";
