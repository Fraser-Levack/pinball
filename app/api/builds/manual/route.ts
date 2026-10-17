// POST { name, score, prompt, summary, html } → adds an app by hand, for builds made before the
// game saved index.html and the prompt. The app is linked to the leaderboard run with exactly this
// prompt if there is one; otherwise a run is created for it from the name and score given.

import { randomUUID } from "node:crypto";
import { BUILDS_ENABLED, BUILDS_OFF_MESSAGE } from "@/lib/build/enabled";
import { isJson, isLocalRequest, refuse } from "@/lib/build/local";
import { MAX_HTML_BYTES, MAX_SUMMARY, titleFromHtml } from "@/lib/builds";
import { supabase } from "@/lib/supabase";

// Same limits as app/api/scores.
const MAX_NAME = 16;
const MAX_SCORE = 10_000_000;
const MAX_PROMPT = 20000;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(request: Request) {
  if (!BUILDS_ENABLED) return refuse(404, BUILDS_OFF_MESSAGE);
  if (!isLocalRequest(request)) return refuse(403, "Apps can only be added from this computer.");
  if (!isJson(request)) return refuse(415, "Send the request as JSON.");

  const body = await request.json().catch(() => null);
  const name = str(body?.name);
  const prompt = str(body?.prompt);
  const summary = str(body?.summary);
  const html = typeof body?.html === "string" ? body.html : "";
  const score = body?.score ?? 0;

  if (!prompt || prompt.length > MAX_PROMPT) return refuse(400, `The prompt must be 1-${MAX_PROMPT} characters.`);
  if (!summary || summary.length > MAX_SUMMARY) return refuse(400, `The description must be 1-${MAX_SUMMARY} characters.`);
  if (!/<html|<body|<script|<canvas|<div/i.test(html)) return refuse(400, "That doesn't look like an HTML page.");
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) return refuse(422, "index.html is over 1 MB.");

  const found = await supabase(`scores?select=id&prompt=eq.${encodeURIComponent(prompt)}&order=created_at.asc&limit=1`);
  if (!found.ok) return refuse(502, "Could not reach the leaderboard.");
  let [run] = (await found.json()) as { id: string }[];
  const linked = !!run;

  if (!run) {
    if (!name || name.length > MAX_NAME) {
      return refuse(400, `No leaderboard run has this prompt, so a player name (1-${MAX_NAME} characters) is needed.`);
    }
    if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return refuse(400, "Invalid score.");
    const created = await supabase("scores", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({ player_name: name, score, sections: 0, prompt }),
    });
    if (!created.ok) {
      console.error("Adding a run for a manual app failed:", created.status, await created.text());
      return refuse(502, "Could not save the leaderboard run for this app.");
    }
    [run] = await created.json();
  }

  const res = await supabase("builds", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      score_id: run.id,
      build_key: `manual-${randomUUID()}`,
      title: titleFromHtml(html),
      summary,
      html,
    }),
  });
  if (!res.ok) {
    console.error("Adding a manual app failed:", res.status, await res.text());
    return refuse(502, "Could not add this app.");
  }
  const [row] = await res.json();
  return Response.json({ id: row.id, linked }, { status: 201 });
}
