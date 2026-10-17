// Game state, rule helpers and the physics loop. The playfield itself (features and the
// rules wired to them) lives in table.ts. Units are table pixels; time is seconds.

import { COLOR, PALETTE } from "./draw";
import type { Feature } from "./features/feature";
import { BALL_R, type Ball, collideCapsule, collideCircle, v } from "./physics";
import { type PromptRun, beginRun, createRun, endRun, revealToken } from "./prompt/run";

export const W = 500;
export const H = 1000;
export const LANE_X = 440; // shooter lane divider
export const PLUNGER_Y = 970;
export const PLUNGER_TRAVEL = 30;

const GRAVITY = 1000;
const MAX_SPEED = 2400;
const SUBSTEPS = 4;
const STUCK_RADIUS = 4; // a ball that stays within this many pixels...
const STUCK_SECONDS = 1.5; // ...for this long gets nudged free
const BALLS_PER_GAME = 1;
const AUTO_LAUNCH_SPEED = 1500;

export type Phase = "ready" | "playing" | "gameover";

export interface Controls {
  left: boolean;
  right: boolean;
  plunger: boolean;
}

export interface Game {
  features: Feature[];
  balls: Ball[]; // every ball on the table (more than one during multiball)
  phase: Phase;
  score: number;
  prompt: PromptRun; // the AI prompt being built: each score reveals letters of the current goal
  ballsLeft: number; // including the one in play
  plunger: number; // 0..1 pull amount
  bonus: number; // paid out × multiplier when the ball drains
  multiplier: number;
  flags: Record<string, boolean>; // rule state for table.ts, e.g. "lock" being lit
  counters: Record<string, number>; // rule counters for table.ts
  messages: Message[]; // queue shown in the middle of the table
  popups: Popup[]; // points floating up from where they were scored
  timers: { at: number; fn: (g: Game) => void }[];
  events: string[]; // drained each frame to play sounds and rumble the controller
  controls: Controls;
  prevControls: Controls;
  time: number;
}

export interface Message {
  text: string;
  time: number;
  color?: string;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  time: number;
}

const NO_CONTROLS: Controls = { left: false, right: false, plunger: false };

export function createGame(features: Feature[]): Game {
  return {
    features,
    balls: [],
    phase: "ready",
    score: 0,
    prompt: createRun(),
    ballsLeft: BALLS_PER_GAME,
    plunger: 0,
    bonus: 0,
    multiplier: 1,
    flags: {},
    counters: {},
    messages: [],
    popups: [],
    timers: [],
    events: [],
    controls: NO_CONTROLS,
    prevControls: NO_CONTROLS,
    time: 0,
  };
}

// ---- Rule helpers: call these from hit handlers in table.ts ----

/**
 * Add points. Every score also reveals a couple of letters of the current prompt goal;
 * returns those letters (empty when nothing was revealed).
 */
export function award(g: Game, points: number): string {
  if (points <= 0) return "";
  g.score += points;
  if (g.phase !== "playing") return "";
  const reveal = revealToken(g.prompt);
  if (!reveal) return "";
  if (reveal.completed) {
    showMessage(g, `${reveal.completed.toUpperCase()} COMPLETE`, { seconds: 2, color: COLOR.save });
    g.events.push("goal");
  }
  return reveal.letters;
}

export function showMessage(g: Game, text: string, opts: { seconds?: number; color?: string } = {}) {
  if (g.messages.length < 4) g.messages.push({ text, time: opts.seconds ?? 1.6, color: opts.color });
}

/** Run `fn` after `seconds` of game time. */
export function after(g: Game, seconds: number, fn: (g: Game) => void) {
  g.timers.push({ at: g.time + seconds, fn });
}

/** Put a new ball in the shooter lane, optionally firing it straight away. */
export function serveBall(g: Game, autoLaunch = false) {
  const ball: Ball = { x: 460, y: PLUNGER_Y - BALL_R - 3, vx: 0, vy: 0, held: false };
  if (autoLaunch) ball.vy = -AUTO_LAUNCH_SPEED;
  g.balls.push(ball);
}

export function startMultiball(g: Game) {
  serveBall(g, true);
  showMessage(g, "MULTIBALL!", { seconds: 2.5 });
  g.events.push("multiball");
}

export function addExtraBall(g: Game) {
  g.ballsLeft += 1;
  showMessage(g, "EXTRA BALL!", { seconds: 2.5 });
  g.events.push("bonus");
}

// ---- Game flow ----

export function startGame(g: Game) {
  g.phase = "playing";
  g.score = 0;
  g.prompt = createRun();
  g.ballsLeft = BALLS_PER_GAME;
  g.balls = [];
  g.bonus = 0;
  g.multiplier = 1;
  g.flags = {};
  g.counters = {};
  g.messages = [];
  g.popups = [];
  g.timers = [];
  g.events.push("start");
  for (const f of g.features) f.reset?.(g);
  newBall(g);
}

function newBall(g: Game) {
  serveBall(g);
}

function endOfBall(g: Game) {
  g.events.push("drain");
  showMessage(g, "BALL LOST", { color: PALETTE.pink });
  const bonus = g.bonus * g.multiplier;
  if (bonus > 0) {
    award(g, bonus);
    showMessage(g, `BONUS ${g.bonus} x${g.multiplier}`, { seconds: 2.5 });
  }
  g.bonus = 0;
  g.multiplier = 1;
  g.ballsLeft -= 1;
  if (g.ballsLeft > 0) {
    newBall(g);
  } else {
    g.phase = "gameover";
    endRun(g.prompt);
    g.events.push("gameover");
  }
}

export function inShooterLane(b: Ball) {
  return b.x > LANE_X && b.y > PLUNGER_Y - 80;
}

function collideBalls(a: Ball, b: Ball) {
  if (a.held && b.held) return;
  if (a.held || b.held) {
    const [moving, parked] = a.held ? [b, a] : [a, b];
    collideCircle(moving, parked, BALL_R, 0.5);
    return;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  const minDist = BALL_R * 2;
  if (d2 >= minDist * minDist || d2 === 0) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const push = (minDist - d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return;
  const j = (-(1 + 0.9) * vn) / 2;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
}

export function stepGame(g: Game, c: Controls, dt: number) {
  g.prevControls = g.controls;
  g.controls = c;
  g.time += dt;
  const playing = g.phase === "playing";

  // Plunger: hold to pull back, release to fire.
  // Only pulls while a ball is waiting in the shooter lane, so holding both flippers in play is harmless.
  const waiting = playing ? g.balls.filter(inShooterLane) : [];
  if (c.plunger && waiting.length > 0) {
    g.plunger = Math.min(1, g.plunger + dt * 1.2);
  } else if (g.plunger > 0) {
    for (const b of waiting) {
      // The plunger snaps back to its rest position, carrying the ball with it.
      b.y = Math.min(b.y, PLUNGER_Y - BALL_R - 2.5);
      b.vy = -(500 + 1100 * g.plunger);
    }
    if (waiting.length > 0) {
      g.events.push("launch");
      beginRun(g.prompt);
    }
    g.plunger = 0;
  }
  const py = PLUNGER_Y + g.plunger * PLUNGER_TRAVEL;
  const plungerA = v(LANE_X, py);
  const plungerB = v(480, py);

  const h = dt / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) {
    for (const f of g.features) f.step?.(g, h);
    if (!playing) continue;

    for (const ball of g.balls) {
      if (ball.held) continue;
      ball.vy += GRAVITY * h;
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      collideCapsule(ball, plungerA, plungerB, 2, 0.1);
      for (const f of g.features) f.collide?.(g, ball);

      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > MAX_SPEED) {
        ball.vx *= MAX_SPEED / speed;
        ball.vy *= MAX_SPEED / speed;
      }
    }
    for (let a = 0; a < g.balls.length; a++) {
      for (let b = a + 1; b < g.balls.length; b++) collideBalls(g.balls[a], g.balls[b]);
    }
  }

  for (const f of g.features) f.tick?.(g, dt);

  const due = g.timers.filter((t) => t.at <= g.time);
  g.timers = g.timers.filter((t) => t.at > g.time);
  for (const t of due) t.fn(g);

  for (const p of g.popups) {
    p.time -= dt;
    p.y -= dt * 40;
  }
  g.popups = g.popups.filter((p) => p.time > 0);

  if (g.messages.length > 0) {
    g.messages[0].time -= dt;
    if (g.messages[0].time <= 0) g.messages.shift();
  }

  if (!playing) return;

  // Safety net: a ball that has stopped dead somewhere it shouldn't gets nudged back into play.
  // Balls on the plunger, parked in a saucer, or cradled on a raised flipper are left alone.
  for (const b of g.balls) {
    const r = b.rest;
    if (!r || Math.hypot(b.x - r.x, b.y - r.y) > STUCK_RADIUS || b.held || inShooterLane(b) || c.left || c.right) {
      b.rest = { x: b.x, y: b.y, time: 0 };
    } else if ((r.time += dt) > STUCK_SECONDS) {
      b.vx = b.x < W / 2 ? 200 : -200;
      b.vy = -300;
      b.rest = undefined;
    }
  }

  g.balls = g.balls.filter((b) => b.y <= H + BALL_R * 3);
  if (g.balls.length === 0) endOfBall(g);
}
