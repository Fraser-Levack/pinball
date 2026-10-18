import Pinball from "@/components/Pinball";

// Hosted (e.g. on Vercel) there's no Claude Code or disk to build into, so players build with their
// own Anthropic API key instead (lib/build/cloud.ts). PINBALL_BUILD_MODE=cloud|local overrides this.
const cloudBuilds = process.env.PINBALL_BUILD_MODE
  ? process.env.PINBALL_BUILD_MODE === "cloud"
  : !!process.env.VERCEL;

export default function Home() {
  return <Pinball cloudBuilds={cloudBuilds} />;
}
