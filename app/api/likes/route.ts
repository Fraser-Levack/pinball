// GET ?liker=<id> → the ids of the apps this browser has liked.
// POST { id, liker, liked } → likes (or unlikes) an app and returns { likes }, its new count.
// There are no accounts: `liker` is a random id each browser makes for itself (components/LikeButton.tsx).

import { isJson, refuse } from "@/lib/build/local";
import { isUuid } from "@/lib/builds";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const liker = new URL(request.url).searchParams.get("liker") ?? "";
  if (!isUuid(liker)) return refuse(400, "Bad request.");
  const res = await supabase(`build_likes?select=build_id&liker=eq.${liker}&limit=1000`);
  if (!res.ok) return refuse(502, "Could not load likes.");
  const rows: { build_id: string }[] = await res.json();
  return Response.json(rows.map((r) => r.build_id));
}

export async function POST(request: Request) {
  if (!isJson(request)) return refuse(415, "Send the request as JSON.");
  const body = await request.json().catch(() => null);
  const { id, liker, liked } = body ?? {};
  if (typeof id !== "string" || !isUuid(id) || typeof liker !== "string" || !isUuid(liker) || typeof liked !== "boolean") {
    return refuse(400, "Bad request.");
  }

  const res = liked
    ? await supabase("build_likes", {
        method: "POST",
        prefer: "resolution=ignore-duplicates", // liking twice is a no-op
        body: JSON.stringify({ build_id: id, liker }),
      })
    : await supabase(`build_likes?build_id=eq.${id}&liker=eq.${liker}`, { method: "DELETE" });
  if (res.status === 409) return refuse(404, "That app doesn't exist.");
  if (!res.ok) {
    console.error("Saving like failed:", res.status, await res.text());
    return refuse(502, "Could not save your like.");
  }

  const countRes = await supabase(`builds?select=like_count&id=eq.${id}`);
  const [row] = countRes.ok ? await countRes.json() : [];
  if (!row) return refuse(404, "That app doesn't exist.");
  return Response.json({ likes: row.like_count });
}
