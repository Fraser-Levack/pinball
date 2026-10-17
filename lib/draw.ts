// Flat, block-colour drawing helpers and the palette shared by the renderer and every feature.

import type { Vec } from "./physics";

// The palette: a cream table with four block colours, plus a dark ink for walls and text.
export const PALETTE = {
  cream: "#f8ffe5",
  mint: "#06d6a0",
  teal: "#1b9aaa",
  pink: "#ef476f",
  yellow: "#ffc43d",
  ink: "#12464f", // teal darkened, for text and outlines that need contrast on cream
};

export const BG = PALETTE.cream;
export const INK = PALETTE.ink;
export const LINE = INK;

// Each group of targets has its own colour, and the lights it earns use the same one,
// so players can see what lights what.
export const COLOR = {
  wall: INK,
  lanes: PALETTE.yellow, // top lanes → bonus multiplier
  drops: PALETTE.pink, // drop targets → lock
  standups: PALETTE.teal, // standup targets
  saucer: PALETTE.pink, // saucer: collects what the drop targets light
  spinner: PALETTE.yellow, // spinner / orbit
  bumper: PALETTE.mint, // bumpers and slingshots
  flipper: INK,
  save: PALETTE.mint, // prompt progress and start prompts
};

/** `#rrggbb` → `rgba(...)` with the given opacity. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Darker version of a block colour, readable as text on the cream table. */
export function shade(hex: string, amount = 0.45): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c: number) => Math.round(c * (1 - amount));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function line(ctx: CanvasRenderingContext2D, a: Vec, b: Vec) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Thick round-ended bar: the block-colour stand-in for a capsule outline. */
export function bar(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, width: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  line(ctx, a, b);
  ctx.restore();
}

export function circle(ctx: CanvasRenderingContext2D, p: Vec, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

export function disc(ctx: CanvasRenderingContext2D, p: Vec, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function capsule(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

export const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const MONO = "ui-monospace, 'Cascadia Mono', Consolas, monospace";

/** Centred text; `\n` splits it over several lines. */
export function label(ctx: CanvasRenderingContext2D, text: string, p: Vec, size: number, color = INK, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  text.split("\n").forEach((t, i) => ctx.fillText(t, p.x, p.y + i * size * 1.2));
}
