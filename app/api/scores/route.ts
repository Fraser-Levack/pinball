import { supabase } from "@/lib/supabase";

const MAX_NAME = 16;
const MAX_SCORE = 10_000_000;
const MAX_SECTIONS = 1000;
const MAX_PROMPT = 20000;

export async function GET() {
  const res = await supabase("scores?select=id,player_name,score,sections,prompt,created_at&order=score.desc&limit=50");
  if (!res.ok) return Response.json({ error: "Could not load scores" }, { status: 502 });
  return Response.json(await res.json());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const { score, sections } = body ?? {};
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";

  if (!name || name.length > MAX_NAME) {
    return Response.json({ error: `Name must be 1-${MAX_NAME} characters` }, { status: 400 });
  }
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return Response.json({ error: "Invalid score" }, { status: 400 });
  }
  if (!Number.isInteger(sections) || sections < 0 || sections > MAX_SECTIONS) {
    return Response.json({ error: "Invalid section count" }, { status: 400 });
  }
  if (!prompt || prompt.length > MAX_PROMPT) {
    return Response.json({ error: "Invalid prompt" }, { status: 400 });
  }

  const res = await supabase("scores", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({ player_name: name, score, sections, prompt }),
  });
  if (!res.ok) {
    console.error("Saving score failed:", res.status, await res.text());
    return Response.json({ error: "Could not save score" }, { status: 502 });
  }
  const [row] = await res.json();
  return Response.json(row, { status: 201 });
}
