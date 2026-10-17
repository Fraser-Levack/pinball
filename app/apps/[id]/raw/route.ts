// GET → a shared app's HTML, locked in a sandbox. These pages are AI-written from random prompts,
// so the CSP `sandbox` directive gives them an opaque origin (no access to this site's cookies,
// storage or API, even if opened directly) and they can't load or send anything over the network.

import { getAppHtml } from "@/lib/builds";

const CSP = [
  "sandbox allow-scripts allow-pointer-lock",
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "frame-ancestors 'self'",
].join("; ");

export async function GET(_request: Request, ctx: RouteContext<"/apps/[id]/raw">) {
  const { id } = await ctx.params;
  const html = await getAppHtml(id).catch(() => null);
  if (html === null) return new Response("Not found", { status: 404 });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}
