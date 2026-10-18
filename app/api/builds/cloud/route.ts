// POST { scoreId, prompt, build: { id, html, summary, signature } } → saves a finished cloud build
// to the builds table, linked to the leaderboard run whose prompt it was built from. The signature
// proves the page is what app/api/build/cloud got back from Claude for that prompt.

import { verifyBuild } from "@/lib/build/cloud";
import { isJson, refuse } from "@/lib/build/local";
import { isUuid, titleFromHtml } from "@/lib/builds";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  if (!isJson(request)) return refuse(415, "Send the request as JSON.");

  const body = await request.json().catch(() => null);
  const { scoreId, prompt, build } = body ?? {};
  if (typeof scoreId !== "string" || !isUuid(scoreId) || typeof prompt !== "string") return refuse(400, "Bad request.");
  const text = prompt.trim();
  if (!verifyBuild(text, build)) return refuse(400, "This page wasn't built by this game, so it can't be saved.");

  // The app must come from that run's prompt, so the leaderboard link is honest.
  const scoreRes = await supabase(`scores?select=prompt&id=eq.${scoreId}`);
  if (!scoreRes.ok) return refuse(502, "Could not reach the leaderboard.");
  const [score] = await scoreRes.json();
  if (!score) return refuse(404, "That leaderboard entry doesn't exist.");
  if (score.prompt.trim() !== text) return refuse(422, "This build wasn't made from that run's prompt.");

  const res = await supabase("builds", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      score_id: scoreId,
      build_key: `cloud-${build.id}`,
      title: titleFromHtml(build.html),
      summary: build.summary,
      html: build.html,
    }),
  });
  if (res.status === 409) return refuse(409, "This build has already been saved.");
  if (!res.ok) {
    console.error("Saving cloud build failed:", res.status, await res.text());
    return refuse(502, "Could not save this build.");
  }
  const [row] = await res.json();
  return Response.json({ id: row.id }, { status: 201 });
}
