// POST { id, target: "page" | "folder" } → opens a finished build on this computer:
// its index.html in the default browser, or the folder in the file manager.

import { openBuild } from "@/lib/build/claude";
import { isJson, isLocalRequest, refuse } from "@/lib/build/local";

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return refuse(403, "Builds can only be opened from the game on this computer.");
  if (!isJson(request)) return refuse(415, "Send the request as JSON.");

  let body: { id?: unknown; target?: unknown };
  try {
    body = await request.json();
  } catch {
    return refuse(400, "Send the request as JSON.");
  }
  const { id, target } = body;
  if (typeof id !== "string" || (target !== "page" && target !== "folder")) return refuse(400, "Bad request.");

  if (!(await openBuild(id, target))) return refuse(404, "That build folder doesn't exist any more.");
  return Response.json({ ok: true });
}
