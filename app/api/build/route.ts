// POST { prompt } → builds it with Claude Code on this computer, streaming progress back as
// newline-delimited JSON BuildEvents (see lib/build/claude.ts).

import { type AddonPass, type BuildEvent, BusyError, buildDir, isBuilding, startBuild } from "@/lib/build/claude";
import { isJson, isLocalRequest, refuse } from "@/lib/build/local";
import { MAX_ADDONS, addonById } from "@/lib/pachinko/addons";

const MAX_PROMPT_LENGTH = 4000;

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return refuse(403, "Builds can only be started from the game on this computer.");
  if (!isJson(request)) return refuse(415, "Send the prompt as JSON.");

  let prompt: unknown;
  let buildId: unknown;
  let addons: unknown;
  try {
    ({ prompt, buildId, addons } = await request.json());
  } catch {
    return refuse(400, "Send the prompt as JSON: { \"prompt\": \"...\" }.");
  }
  if (typeof prompt !== "string" || !prompt.trim()) return refuse(400, "The prompt is empty.");
  if (prompt.length > MAX_PROMPT_LENGTH) return refuse(400, `The prompt is longer than ${MAX_PROMPT_LENGTH} characters.`);
  // Add-on pass: { prompt, buildId, addons } adds pachinko add-ons to a finished build. Only ids
  // from the fixed list are accepted, so nothing free-form reaches Claude this way.
  let pass: AddonPass | undefined;
  if (buildId !== undefined || addons !== undefined) {
    if (typeof buildId !== "string" || !buildDir(buildId)) return refuse(400, "Unknown build.");
    if (
      !Array.isArray(addons) ||
      addons.length === 0 ||
      addons.length > MAX_ADDONS ||
      !addons.every((a) => typeof a === "string" && addonById(a))
    ) {
      return refuse(400, "Unknown add-ons.");
    }
    pass = { id: buildId, addons: [...new Set(addons as string[])] };
  }
  if (isBuilding()) return refuse(409, new BusyError().message);

  const text = prompt.trim();
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
      try {
        cancel = startBuild(text, emit, pass);
      } catch (e) {
        emit({ type: "error", message: (e as Error).message });
      }
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
