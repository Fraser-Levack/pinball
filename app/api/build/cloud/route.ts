// POST { prompt, apiKey } → builds it with the Claude API using the player's own key, streaming
// progress back as newline-delimited JSON BuildEvents, like app/api/build does for local builds.
// The "done" event carries the page and a signature, which app/api/builds/cloud needs to save it.
// With { base, addons } too, adds pachinko add-ons to that earlier build. See lib/build/cloud.ts.

import type { BuildEvent } from "@/lib/build/claude";
import { type CloudAddonPass, isApiKey, startCloudBuild, verifyBuild } from "@/lib/build/cloud";
import { isJson, refuse } from "@/lib/build/local";
import { MAX_ADDONS, addonById } from "@/lib/pachinko/addons";

// Seconds. Vercel's Hobby plan allows up to 300; keep lib/build/cloud.ts's TIME_LIMIT_MS just under it.
export const maxDuration = 300;

const MAX_PROMPT_LENGTH = 4000;

export async function POST(request: Request) {
  if (!isJson(request)) return refuse(415, "Send the prompt as JSON.");

  const body = await request.json().catch(() => null);
  const { prompt, apiKey, base, addons } = body ?? {};
  if (typeof prompt !== "string" || !prompt.trim()) return refuse(400, "The prompt is empty.");
  if (prompt.length > MAX_PROMPT_LENGTH) return refuse(400, `The prompt is longer than ${MAX_PROMPT_LENGTH} characters.`);
  if (!isApiKey(apiKey)) return refuse(400, "That doesn't look like an Anthropic API key (they start with sk-ant-).");

  const text = prompt.trim();
  // Add-on pass: only a page this server built from the same prompt can be the base, and only ids
  // from the fixed add-on list are accepted, so nothing free-form reaches Claude this way.
  let pass: CloudAddonPass | undefined;
  if (base !== undefined || addons !== undefined) {
    if (!verifyBuild(text, base)) return refuse(400, "Unknown build.");
    if (
      !Array.isArray(addons) ||
      addons.length === 0 ||
      addons.length > MAX_ADDONS ||
      !addons.every((a) => typeof a === "string" && addonById(a))
    ) {
      return refuse(400, "Unknown add-ons.");
    }
    pass = { base, addons: [...new Set(addons as string[])] };
  }

  const encoder = new TextEncoder();
  let cancel: (() => void) | null = null;
  let open = true;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (e: BuildEvent) => {
        if (!open) return;
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        if (e.type === "done" || e.type === "error") {
          open = false;
          controller.close();
        }
      };
      cancel = startCloudBuild(apiKey, text, emit, pass);
    },
    // The player cancelled, closed the tab or navigated away: stop Claude too.
    cancel() {
      open = false;
      cancel?.();
    },
  });
  request.signal.addEventListener("abort", () => cancel?.());

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
