// Server-only queries for shared apps (the builds table). See supabase/schema.sql.

import { supabase } from "@/lib/supabase";

export interface SharedApp {
  id: string;
  title: string | null; // older shares have none: use appTitle()
  summary: string;
  featured: boolean;
  like_count: number;
  created_at: string;
  scores: { player_name: string; score: number; prompt: string };
}

/** How the apps list is ordered: most liked first, or newest first. */
export type AppSort = "popular" | "new";
export const APP_SORTS: AppSort[] = ["popular", "new"];

const FIELDS = "id,title,summary,featured,like_count,created_at,scores(player_name,score,prompt)";
const ORDER: Record<AppSort, string> = { popular: "like_count.desc,created_at.desc", new: "created_at.desc" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_TITLE = 60;
export const MAX_HTML_BYTES = 1_000_000;
export const MAX_SUMMARY = 600;

export const isUuid = (s: string) => UUID_RE.test(s);

/** The page's own <title>, if it has a usable one. */
export function titleFromHtml(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const t = m[1]
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || /^(document|index|untitled)$/i.test(t)) return null;
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1)}…` : t;
}

/** The app's name: its title, or else the opening words of Claude's summary. */
export function appTitle(app: SharedApp): string {
  if (app.title) return app.title;
  const words = app.summary.replace(/^I (built|made|created) (an? |the )?/i, "").split(/\s+/).slice(0, 6).join(" ");
  const t = words.replace(/[.,:;—-]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Hand-picked apps first, then the rest in `sort` order. Throws if Supabase can't be reached. */
export async function listApps(sort: AppSort = "popular"): Promise<{ featured: SharedApp[]; recent: SharedApp[] }> {
  const [featured, recent] = await Promise.all([
    supabase(`builds?select=${FIELDS}&featured=is.true&order=${ORDER[sort]}&limit=12`),
    supabase(`builds?select=${FIELDS}&featured=is.false&order=${ORDER[sort]}&limit=48`),
  ]);
  for (const res of [featured, recent]) {
    if (!res.ok) throw new Error(`Could not load apps: ${res.status} ${await res.text()}`);
  }
  return { featured: await featured.json(), recent: await recent.json() };
}

export async function getApp(id: string): Promise<SharedApp | null> {
  if (!isUuid(id)) return null;
  const res = await supabase(`builds?select=${FIELDS}&id=eq.${id}`);
  if (!res.ok) throw new Error("Could not load app");
  const [row] = await res.json();
  return row ?? null;
}

export async function getAppHtml(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;
  const res = await supabase(`builds?select=html&id=eq.${id}`);
  if (!res.ok) throw new Error("Could not load app");
  const [row] = await res.json();
  return row?.html ?? null;
}
