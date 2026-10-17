// Server-only REST client for Supabase. The service role key bypasses row level security,
// so it must never reach the browser: only import this from route handlers and server code.

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabase(path: string, init: { method?: string; body?: string; prefer?: string } = {}) {
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return fetch(`${url}/rest/v1/${path}`, {
    method: init.method,
    body: init.body,
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.prefer && { Prefer: init.prefer }),
    },
  });
}
