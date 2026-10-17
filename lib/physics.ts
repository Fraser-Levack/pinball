// Shared vector maths and ball collision. Units are table pixels; time is seconds.

export const BALL_R = 10;

export type Vec = { x: number; y: number };

export const v = (x: number, y: number): Vec => ({ x, y });

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  held: boolean; // parked by a feature (e.g. a saucer); skips physics while true
  rest?: { x: number; y: number; time: number }; // where it has been sitting still, for the stuck-ball nudge
}

export interface Contact {
  impact: number; // closing speed along the normal
  nx: number;
  ny: number;
}

const ZERO = v(0, 0);

export function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return v(a.x + abx * t, a.y + aby * t);
}

/** Which side of the line a→b the point is on: positive one side, negative the other. */
export function side(p: Vec, a: Vec, b: Vec): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** Push the ball out of a circle at `c` and bounce it. `sv` is the surface velocity at the contact. */
function resolve(ball: Ball, c: Vec, minDist: number, restitution: number, sv: Vec): Contact | null {
  const dx = ball.x - c.x;
  const dy = ball.y - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDist * minDist || d2 === 0) return null;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  ball.x = c.x + nx * minDist;
  ball.y = c.y + ny * minDist;

  const vn = (ball.vx - sv.x) * nx + (ball.vy - sv.y) * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
  }
  return { impact: -vn, nx, ny };
}

/**
 * Resolve ball vs. capsule (segment with radius). `surface` gives the velocity of the
 * capsule at the contact point (for moving flippers). Returns the contact, or null if none.
 */
export function collideCapsule(
  ball: Ball,
  a: Vec,
  b: Vec,
  r: number,
  restitution: number,
  surface?: (c: Vec) => Vec,
): Contact | null {
  const c = closestOnSegment(ball, a, b);
  return resolve(ball, c, r + BALL_R, restitution, surface ? surface(c) : ZERO);
}

export function collideCircle(ball: Ball, p: Vec, r: number, restitution: number): Contact | null {
  return resolve(ball, p, r + BALL_R, restitution, ZERO);
}

// Max wobble on a kick: about ±3° of direction and ±3% of strength. Too small to notice, but enough
// that a ball can't settle into the same bounce path between bumpers forever.
const KICK_ANGLE_JITTER = 0.05;
const KICK_SPEED_JITTER = 0.03;

/** Push the ball along the contact normal (nx, ny), with a touch of randomness. */
export function kick(ball: Ball, nx: number, ny: number, speed: number) {
  const a = (Math.random() * 2 - 1) * KICK_ANGLE_JITTER;
  const s = speed * (1 + (Math.random() * 2 - 1) * KICK_SPEED_JITTER);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  ball.vx += (nx * cos - ny * sin) * s;
  ball.vy += (nx * sin + ny * cos) * s;
}
