// POST { buildId, scoreId, summary } → shares a finished build: uploads its index.html to the
// builds table, linked to the leaderboard run whose prompt it was built from.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PROMPT_FILE, buildDir, listFiles } from "@/lib/build/claude";
import { isJson, isLocalRequest, refuse } from "@/lib/build/local";
import { isUuid, titleFromHtml } from "@/lib/builds";
import { supabase } from "@/lib/supabase";

const MAX_HTML_BYTES = 1_000_000;
const MAX_SUMMARY = 600;

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return refuse(403, "Builds can only be shared from the game on this computer.");
  if (!isJson(request)) return refuse(415, "Send the request as JSON.");

  const body = await request.json().catch(() => null);
  const { buildId, scoreId } = body ?? {};
  const summary = typeof body?.summary === "string" ? body.summary.trim().slice(0, MAX_SUMMARY) : "";
  if (typeof buildId !== "string" || typeof scoreId !== "string" || !isUuid(scoreId) || !summary) {
    return refuse(400, "Bad request.");
  }
  const dir = buildDir(buildId);
  if (!dir) return refuse(400, "Bad request.");

  let files: string[];
  let html: string;
  let builtPrompt: string;
  try {
    files = await listFiles(dir);
    html = await readFile(path.join(dir, "index.html"), "utf8");
    builtPrompt = (await readFile(path.join(dir, PROMPT_FILE), "utf8")).trim();
  } catch {
    return refuse(404, "That build folder or its index.html doesn't exist any more.");
  }
  if (files.length !== 1) {
    return refuse(422, "Only single-file builds can be shared: this one has files besides index.html.");
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) return refuse(422, "index.html is over 1 MB.");

  // The app must come from that run's prompt, so the leaderboard link is honest.
  const scoreRes = await supabase(`scores?select=prompt&id=eq.${scoreId}`);
  if (!scoreRes.ok) return refuse(502, "Could not reach the leaderboard.");
  const [score] = await scoreRes.json();
  if (!score) return refuse(404, "That leaderboard entry doesn't exist.");
  if (score.prompt.trim() !== builtPrompt) return refuse(422, "This build wasn't made from that run's prompt.");

  const res = await supabase("builds", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({ score_id: scoreId, build_key: buildId, title: titleFromHtml(html), summary, html }),
  });
  if (res.status === 409) return refuse(409, "This build has already been shared.");
  if (!res.ok) {
    console.error("Sharing build failed:", res.status, await res.text());
    return refuse(502, "Could not share this build.");
  }
  const [row] = await res.json();
  return Response.json({ id: row.id }, { status: 201 });
}
