// Guards for the build routes, which start programs on this computer.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True when the request was addressed to this machine (not a LAN address) and, if it came
 * from a web page, from the game's own page. Browsers always send Origin on POST, so a page
 * on another site, or a built page opened from disk (Origin "null"), is refused. The Host
 * check also defeats DNS-rebinding tricks.
 */
export function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host");
  if (!host) return false;
  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return false;
  }
  if (!LOCAL_HOSTS.has(hostname)) return false;
  const origin = request.headers.get("origin");
  return origin === null || origin === `http://${host}` || origin === `https://${host}`;
}

/** Requiring a JSON body means another site can't trigger this with a plain form post. */
export function isJson(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

export function refuse(status: number, error: string) {
  return Response.json({ error }, { status });
}
