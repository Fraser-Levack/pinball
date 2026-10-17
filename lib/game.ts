// Table geometry, game state and physics. Units are table pixels; time is seconds.

export const W = 500;
export const H = 800;
export const BALL_R = 10;

const GRAVITY = 1000;
const MAX_SPEED = 2400;
const SUBSTEPS = 4;
const PLUNGER_Y = 770;
const PLUNGER_TRAVEL = 30;
const LANE_X = 440;

export type Vec = { x: number; y: number };

export interface Wall {
  a: Vec;
  b: Vec;
  r: number;
  restitution: number;
  kick: number; // > 0 for slingshot faces
  flash: number;
}

export interface Bumper {
  p: Vec;
  r: number;
  flash: number;
}

export interface Flipper {
  pivot: Vec;
  len: number;
  r: number;
  rest: number;
  up: number;
  angle: number;
  omega: number;
}

export interface Rollover {
  p: Vec;
  lit: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type Phase = "ready" | "playing" | "gameover";
export type GameEvent = "bumper" | "sling" | "flipper" | "launch" | "drain" | "bonus";

export interface Game {
  walls: Wall[];
  plungerWall: Wall;
  bumpers: Bumper[];
  flippers: [Flipper, Flipper];
  rollovers: Rollover[];
  ball: Ball;
  phase: Phase;
  score: number;
  balls: number;
  plunger: number; // 0..1 pull amount
  bonusFlash: number;
  events: GameEvent[];
}

export interface Controls {
  left: boolean;
  right: boolean;
  plunger: boolean;
}

const v = (x: number, y: number): Vec => ({ x, y });

function wall(a: Vec, b: Vec, opts: Partial<Wall> = {}): Wall {
  return { a, b, r: 2, restitution: 0.5, kick: 0, flash: 0, ...opts };
}

function chain(points: Vec[], opts: Partial<Wall> = {}): Wall[] {
  const out: Wall[] = [];
  for (let i = 0; i < points.length - 1; i++) out.push(wall(points[i], points[i + 1], opts));
  return out;
}

const mirror = (p: Vec): Vec => v(LANE_X + 20 - p.x, p.y); // mirror around playfield centre (x = 230)

function buildWalls(): Wall[] {
  const walls: Wall[] = [];

  // Top arch
  const arc: Vec[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = Math.PI + (Math.PI * i) / N;
    arc.push(v(250 + 230 * Math.cos(t), 250 + 230 * Math.sin(t)));
  }
  walls.push(...chain(arc));

  // Outer sides
  walls.push(wall(v(20, 250), v(20, 600)));
  walls.push(wall(v(480, 250), v(480, PLUNGER_Y)));

  // Shooter lane divider
  walls.push(wall(v(LANE_X, 260), v(LANE_X, PLUNGER_Y)));

  // Inlane guides down to the flippers
  const inlane = [v(20, 600), v(138, 676)];
  walls.push(wall(inlane[0], inlane[1]));
  walls.push(wall(v(LANE_X, 600), mirror(inlane[1])));

  // Slingshots: triangle, the long face kicks
  const sling = [v(60, 500), v(60, 580), v(115, 620)];
  for (const pts of [sling, sling.map(mirror)]) {
    walls.push(wall(pts[0], pts[1], { r: 3 }));
    walls.push(wall(pts[1], pts[2], { r: 3 }));
    walls.push(wall(pts[2], pts[0], { r: 3, kick: 420, restitution: 0.6 }));
  }

  // Top lane dividers
  for (const x of [170, 220, 270, 320]) walls.push(wall(v(x, 70), v(x, 110), { r: 3 }));

  return walls;
}

function makeFlipper(pivot: Vec, left: boolean): Flipper {
  const rest = left ? 0.5 : Math.PI - 0.5;
  const up = left ? -0.45 : Math.PI + 0.45;
  return { pivot, len: 68, r: 8, rest, up, angle: rest, omega: 0 };
}

function spawnBall(): Ball {
  return { x: 460, y: PLUNGER_Y - BALL_R - 3, vx: 0, vy: 0 };
}

export function createGame(): Game {
  const plungerWall = wall(v(LANE_X, PLUNGER_Y), v(480, PLUNGER_Y), { restitution: 0.1 });
  return {
    walls: buildWalls(),
    plungerWall,
    bumpers: [
      { p: v(165, 230), r: 24, flash: 0 },
      { p: v(295, 230), r: 24, flash: 0 },
      { p: v(230, 320), r: 24, flash: 0 },
    ],
    flippers: [makeFlipper(v(145, 680), true), makeFlipper(mirror(v(145, 680)), false)],
    rollovers: [195, 245, 295].map((x) => ({ p: v(x, 90), lit: false })),
    ball: spawnBall(),
    phase: "ready",
    score: 0,
    balls: 3,
    plunger: 0,
    bonusFlash: 0,
    events: [],
  };
}

export function startGame(g: Game) {
  g.phase = "playing";
  g.score = 0;
  g.balls = 3;
  g.ball = spawnBall();
  for (const r of g.rollovers) r.lit = false;
}

export function flipperTip(f: Flipper): Vec {
  return v(f.pivot.x + Math.cos(f.angle) * f.len, f.pivot.y + Math.sin(f.angle) * f.len);
}

function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return v(a.x + abx * t, a.y + aby * t);
}

/**
 * Resolve ball vs. capsule (segment with radius). `surface` gives the velocity of the
 * capsule at the contact point (for moving flippers). Returns the impact speed and normal, or null if no contact.
 */
function collideCapsule(
  ball: Ball,
  a: Vec,
  b: Vec,
  r: number,
  restitution: number,
  surface?: (c: Vec) => Vec,
): { impact: number; nx: number; ny: number } | null {
  const c = closestOnSegment(ball, a, b);
  const dx = ball.x - c.x;
  const dy = ball.y - c.y;
  const minDist = r + BALL_R;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDist * minDist || d2 === 0) return null;

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  ball.x = c.x + nx * minDist;
  ball.y = c.y + ny * minDist;

  const sv = surface ? surface(c) : v(0, 0);
  const vn = (ball.vx - sv.x) * nx + (ball.vy - sv.y) * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
  }
  return { impact: -vn, nx, ny };
}

function updateFlipper(f: Flipper, active: boolean, dt: number) {
  const target = active ? f.up : f.rest;
  const speed = active ? 24 : 14;
  const prev = f.angle;
  const diff = target - f.angle;
  const step = speed * dt;
  f.angle = Math.abs(diff) <= step ? target : f.angle + Math.sign(diff) * step;
  f.omega = (f.angle - prev) / dt;
}

function stepBall(g: Game, dt: number) {
  const ball = g.ball;
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  for (const w of g.walls) {
    const hit = collideCapsule(ball, w.a, w.b, w.r, w.restitution);
    if (hit && w.kick > 0 && hit.impact > 60) {
      ball.vx += hit.nx * w.kick;
      ball.vy += hit.ny * w.kick;
      w.flash = 1;
      g.score += 10;
      g.events.push("sling");
    }
  }

  const pw = g.plungerWall;
  collideCapsule(ball, pw.a, pw.b, pw.r, pw.restitution);

  for (const bp of g.bumpers) {
    const dx = ball.x - bp.p.x;
    const dy = ball.y - bp.p.y;
    const minDist = bp.r + BALL_R;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDist * minDist && d2 > 0) {
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      ball.x = bp.p.x + nx * minDist;
      ball.y = bp.p.y + ny * minDist;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= 1.8 * vn * nx;
        ball.vy -= 1.8 * vn * ny;
      }
      ball.vx += nx * 380;
      ball.vy += ny * 380;
      bp.flash = 1;
      g.score += 100;
      g.events.push("bumper");
    }
  }

  for (const f of g.flippers) {
    const hit = collideCapsule(ball, f.pivot, flipperTip(f), f.r, 0.3, (c) => {
      const rx = c.x - f.pivot.x;
      const ry = c.y - f.pivot.y;
      return v(-f.omega * ry, f.omega * rx);
    });
    if (hit && hit.impact > 600 && f.omega !== 0) g.events.push("flipper");
  }

  for (const r of g.rollovers) {
    if (r.lit) continue;
    const dx = ball.x - r.p.x;
    const dy = ball.y - r.p.y;
    if (dx * dx + dy * dy < 16 * 16) {
      r.lit = true;
      g.score += 500;
      if (g.rollovers.every((o) => o.lit)) {
        g.score += 5000;
        g.bonusFlash = 1.5;
        g.events.push("bonus");
        for (const o of g.rollovers) o.lit = false;
      }
    }
  }

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    ball.vx *= MAX_SPEED / speed;
    ball.vy *= MAX_SPEED / speed;
  }
}

function ballInShooterLane(b: Ball) {
  return b.x > LANE_X && b.y > PLUNGER_Y - 80;
}

export function stepGame(g: Game, c: Controls, dt: number) {
  // Plunger: hold to pull back, release to fire.
  // Only pulls while the ball is waiting in the shooter lane, so holding both flippers in play is harmless.
  if (c.plunger && g.phase === "playing" && ballInShooterLane(g.ball)) {
    g.plunger = Math.min(1, g.plunger + dt * 1.2);
  } else if (g.plunger > 0) {
    if (ballInShooterLane(g.ball)) {
      // The plunger snaps back to its rest position, carrying the ball with it.
      g.ball.y = Math.min(g.ball.y, PLUNGER_Y - BALL_R - g.plungerWall.r - 0.5);
      g.ball.vy = -(500 + 1100 * g.plunger);
      g.events.push("launch");
    }
    g.plunger = 0;
  }
  const py = PLUNGER_Y + g.plunger * PLUNGER_TRAVEL;
  g.plungerWall.a.y = py;
  g.plungerWall.b.y = py;

  const h = dt / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) {
    updateFlipper(g.flippers[0], c.left, h);
    updateFlipper(g.flippers[1], c.right, h);
    if (g.phase === "playing") stepBall(g, h);
  }

  for (const w of g.walls) w.flash = Math.max(0, w.flash - dt * 4);
  for (const b of g.bumpers) b.flash = Math.max(0, b.flash - dt * 4);
  g.bonusFlash = Math.max(0, g.bonusFlash - dt);

  if (g.phase === "playing" && g.ball.y > H + BALL_R * 3) {
    g.events.push("drain");
    g.balls -= 1;
    if (g.balls > 0) g.ball = spawnBall();
    else g.phase = "gameover";
  }
}
