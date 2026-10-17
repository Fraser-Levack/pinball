// Wireframe drawing helpers and the colour palette shared by the renderer and every feature.

import type { Vec } from "./physics";

export const LINE = "#3c3";
export const BRIGHT = "#cfc";
export const DIM = "#163";

// Each group of targets has its own colour, and the lights it earns use the same one,
// so players can see what lights what.
export const COLOR = {
  wall: LINE,
  lanes: "#ffd23f", // yellow: top lanes → bonus multiplier
  drops: "#ff8c2e", // orange: drop targets → lock / extra ball
  standups: "#3ec8ff", // blue: standup targets → kickback
  saucer: "#ff5cf0", // pink: saucer
  spinner: "#b48cff", // purple: spinner / orbit
  bumper: "#ff4f5e", // red: bumpers and slingshots
  flipper: "#f2f2f2",
  save: "#6f6", // green: ball save
};

/** `#rrggbb` → `rgba(...)` with the given opacity. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function line(ctx: CanvasRenderingContext2D, a: Vec, b: Vec) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
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

export function capsule(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
  ctx.stroke();
}

/** Centred text; `\n` splits it over several lines. */
export function label(ctx: CanvasRenderingContext2D, text: string, p: Vec, size: number, color = BRIGHT) {
  ctx.font = `${size}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  text.split("\n").forEach((t, i) => ctx.fillText(t, p.x, p.y + i * size * 1.2));
}
