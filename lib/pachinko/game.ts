// Pachinko: the minigame that replaces the pinball table while Claude builds the prompt.
// A dropper sweeps along the top; a trigger drops a ball through the pegs into one of the add-on
// buckets at the bottom, a random pick from dictonary/Addons.json (see addons.ts). Same table size and units as the pinball game.

import { BG, INK, PALETTE, alpha, disc, label, roundRect, shade } from "../draw";
import { H, W } from "../game";
import { type Addon, BUCKETS, MAX_ADDONS, bucketColor, pickAddons } from "./addons";

const BALL_R = 9;
const PEG_R = 5;
const GRAVITY = 900;
const BOUNCE = 0.45;
const MAX_BALLS = 6;
const DROP_COOLDOWN = 0.25;
const RAIL_Y = 130;
const RAIL_MIN = 30;
const RAIL_MAX = W - 30;
const SWEEP_SPEED = 220; // dropper px/s
const BUCKET_TOP = 840;
const FLOOR_Y = H - 30;
const BUCKET_W = W / BUCKETS;
const INTRO_SECONDS = 2.2;

interface PBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Flash {
  bucket: number;
  text: string;
  time: number; // seconds left
}

export interface Pachinko {
  buckets: Addon[]; // this round's random pick, left to right
  balls: PBall[];
  pegs: { x: number; y: number; lit: number }[];
  dropX: number;
  dir: 1 | -1;
  cooldown: number;
  time: number;
  dropped: number;
  wins: string[]; // add-on ids won, in order, at most MAX_ADDONS
  locked: boolean; // set once the main build is done: landings no longer win add-ons
  flashes: Flash[];
  events: string[]; // sound names, drained by the caller
}

function makePegs() {
  const pegs: Pachinko["pegs"] = [];
  const gap = 46;
  for (let row = 0, y = 210; y < BUCKET_TOP - 30; row++, y += 40) {
    const offset = row % 2 ? gap / 2 : 0;
    for (let x = 20 + offset; x <= W - 20; x += gap) pegs.push({ x, y, lit: 0 });
  }
  return pegs;
}

export function createPachinko(): Pachinko {
  return {
    buckets: pickAddons(),
    balls: [],
    pegs: makePegs(),
    dropX: W / 2,
    dir: 1,
    cooldown: 0,
    time: 0,
    dropped: 0,
    wins: [],
    locked: false,
    flashes: [],
    events: [],
  };
}

function land(p: Pachinko, bucket: number) {
  const addon = p.buckets[bucket];
  let text: string;
  if (p.locked) text = "LOCKED IN";
  else if (p.wins.includes(addon.id)) text = "GOT IT";
  else if (p.wins.length >= MAX_ADDONS) text = "FULL";
  else {
    p.wins.push(addon.id);
    text = "+ ADD-ON!";
    p.events.push("goal");
  }
  if (text !== "+ ADD-ON!") p.events.push("rollover");
  p.flashes.push({ bucket, text, time: 1.2 });
}

/** One physics step. `drop` is an edge-triggered request to drop a ball. */
export function stepPachinko(p: Pachinko, drop: boolean, dt: number) {
  p.time += dt;
  p.cooldown = Math.max(0, p.cooldown - dt);

  p.dropX += p.dir * SWEEP_SPEED * dt;
  if (p.dropX > RAIL_MAX) (p.dropX = RAIL_MAX), (p.dir = -1);
  if (p.dropX < RAIL_MIN) (p.dropX = RAIL_MIN), (p.dir = 1);

  if (drop && p.time > INTRO_SECONDS && p.cooldown === 0 && p.balls.length < MAX_BALLS) {
    p.balls.push({ x: p.dropX, y: RAIL_Y + 16, vx: p.dir * 30, vy: 0 });
    p.cooldown = DROP_COOLDOWN;
    p.dropped++;
    p.events.push("kick");
  }

  for (const peg of p.pegs) peg.lit = Math.max(0, peg.lit - dt * 3);
  for (const f of p.flashes) f.time -= dt;
  p.flashes = p.flashes.filter((f) => f.time > 0);

  for (const b of p.balls) {
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Side walls.
    if (b.x < BALL_R) (b.x = BALL_R), (b.vx = Math.abs(b.vx) * BOUNCE);
    if (b.x > W - BALL_R) (b.x = W - BALL_R), (b.vx = -Math.abs(b.vx) * BOUNCE);

    // Pegs.
    for (const peg of p.pegs) {
      const dx = b.x - peg.x;
      const dy = b.y - peg.y;
      const min = BALL_R + PEG_R;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      b.x = peg.x + nx * min;
      b.y = peg.y + ny * min;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + BOUNCE) * vn * nx;
        b.vy -= (1 + BOUNCE) * vn * ny;
        b.vx += (Math.random() - 0.5) * 40; // a little chaos so drops aren't predictable
        if (peg.lit < 0.5) p.events.push("spinner");
        peg.lit = 1;
      }
    }

    // Bucket dividers: thin posts with round tops.
    if (b.y > BUCKET_TOP - BALL_R) {
      for (let i = 1; i < BUCKETS; i++) {
        const x = i * BUCKET_W;
        const dx = b.x - x;
        if (Math.abs(dx) >= BALL_R + 2) continue;
        if (b.y < BUCKET_TOP) {
          b.vy = -Math.abs(b.vy) * BOUNCE;
          b.vx += dx >= 0 ? 60 : -60;
        } else {
          b.x = x + (dx >= 0 ? 1 : -1) * (BALL_R + 2);
          b.vx = -b.vx * BOUNCE;
        }
      }
    }
  }

  p.balls = p.balls.filter((b) => {
    if (b.y < FLOOR_Y - BALL_R) return true;
    land(p, Math.min(BUCKETS - 1, Math.max(0, Math.floor(b.x / BUCKET_W))));
    return false;
  });
}

export function renderPachinko(ctx: CanvasRenderingContext2D, p: Pachinko) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Header.
  roundRect(ctx, 20, 20, W - 40, 70, 16, PALETTE.teal);
  label(ctx, "PACHINKO", { x: W / 2, y: 46 }, 26, "#fff", 800);
  label(ctx, p.locked ? "Claude is adding your add-ons…" : "Claude is building · win add-ons for it", { x: W / 2, y: 74 }, 14, "#fff", 600);

  // Rail and dropper.
  ctx.fillStyle = alpha(INK, 0.15);
  ctx.fillRect(RAIL_MIN - 10, RAIL_Y - 3, RAIL_MAX - RAIL_MIN + 20, 6);
  roundRect(ctx, p.dropX - 18, RAIL_Y - 12, 36, 24, 8, INK);
  disc(ctx, { x: p.dropX, y: RAIL_Y + 16 }, BALL_R, p.cooldown > 0 ? alpha(PALETTE.pink, 0.3) : PALETTE.pink);

  // Pegs.
  for (const peg of p.pegs) {
    if (peg.lit > 0) disc(ctx, peg, PEG_R + 5 * peg.lit, alpha(PALETTE.yellow, 0.6 * peg.lit));
    disc(ctx, peg, PEG_R, INK);
  }

  // Buckets.
  p.buckets.forEach((a, i) => {
    const color = bucketColor(i);
    const x = i * BUCKET_W;
    const won = p.wins.includes(a.id);
    roundRect(ctx, x + 3, BUCKET_TOP, BUCKET_W - 6, H - BUCKET_TOP - 10, 10, won ? color : alpha(color, 0.25));
    label(ctx, a.label, { x: x + BUCKET_W / 2, y: BUCKET_TOP + (a.label.includes("\n") ? 40 : 50) }, 12, won ? INK : shade(color), 800);
    if (won) label(ctx, "✓", { x: x + BUCKET_W / 2, y: BUCKET_TOP + 100 }, 26, INK, 800);
  });
  ctx.fillStyle = INK;
  for (let i = 1; i < BUCKETS; i++) {
    const x = i * BUCKET_W;
    ctx.fillRect(x - 2, BUCKET_TOP, 4, H - BUCKET_TOP - 10);
    disc(ctx, { x, y: BUCKET_TOP }, 3, INK);
  }

  for (const b of p.balls) disc(ctx, b, BALL_R, PALETTE.pink);

  for (const f of p.flashes) {
    const a = Math.min(1, f.time * 2);
    const y = BUCKET_TOP - 24 - (1.2 - f.time) * 30;
    label(ctx, f.text, { x: (f.bucket + 0.5) * BUCKET_W, y }, 16, alpha(INK, a), 800);
  }

  label(
    ctx,
    `Press either trigger (Z / M) to drop · add-ons ${p.wins.length}/${MAX_ADDONS}`,
    { x: W / 2, y: BUCKET_TOP - 60 + 40 },
    13,
    alpha(INK, 0.55),
    700,
  );

  // The switch-over card, so it's obvious the pinball table has been swapped out.
  if (p.time < INTRO_SECONDS) {
    const a = Math.min(1, (INTRO_SECONDS - p.time) * 2);
    ctx.fillStyle = alpha(INK, 0.55 * a);
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    roundRect(ctx, 40, 360, W - 80, 220, 20, BG);
    label(ctx, "PINBALL PAUSED", { x: W / 2, y: 400 }, 16, shade(PALETTE.pink), 800);
    label(ctx, "SWITCHING TO\nPACHINKO!", { x: W / 2, y: 450 }, 34, INK, 800);
    label(ctx, "Drop balls into buckets to give\nClaude extra add-ons to build.", { x: W / 2, y: 535 }, 15, INK, 600);
    ctx.globalAlpha = 1;
  }
}
