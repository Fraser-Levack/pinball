import { COLOR, alpha, capsule, circle } from "../draw";
import type { Game } from "../game";
import { type Ball, type Vec, collideCapsule, v } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

/** Flipper driven by the left or right trigger. Hits on a strong swing into the ball. */
export class Flipper extends Feature {
  angle: number;
  omega = 0;
  private len: number;
  private rest: number;
  private up: number;

  constructor(public pivot: Vec, public button: "left" | "right", opts: FeatureOptions & { len?: number } = {}) {
    super({ sound: "flipper", color: COLOR.flipper, ...opts });
    const left = button === "left";
    this.len = opts.len ?? 68;
    this.rest = left ? 0.5 : Math.PI - 0.5;
    this.up = left ? -0.45 : Math.PI + 0.45;
    this.angle = this.rest;
  }

  tip(): Vec {
    return v(this.pivot.x + Math.cos(this.angle) * this.len, this.pivot.y + Math.sin(this.angle) * this.len);
  }

  step(g: Game, dt: number) {
    const active = g.controls[this.button];
    if (active && !g.prevControls[this.button] && this.angle === this.rest) g.events.push("flip");
    const target = active ? this.up : this.rest;
    const speed = active ? 24 : 14;
    const prev = this.angle;
    const diff = target - this.angle;
    const step = speed * dt;
    this.angle = Math.abs(diff) <= step ? target : this.angle + Math.sign(diff) * step;
    this.omega = (this.angle - prev) / dt;
  }

  collide(g: Game, ball: Ball) {
    const hit = collideCapsule(ball, this.pivot, this.tip(), 8, 0.3, (c) => {
      const rx = c.x - this.pivot.x;
      const ry = c.y - this.pivot.y;
      return v(-this.omega * ry, this.omega * rx);
    });
    if (hit && hit.impact > 600 && this.omega !== 0) this.hit(g, ball);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = alpha(this.color, this.angle !== this.rest ? 0.35 : 0.12);
    ctx.strokeStyle = this.angle !== this.rest ? "#fff" : alpha(this.color, 0.8);
    capsule(ctx, this.pivot, this.tip(), 8);
    ctx.fill();
    circle(ctx, this.pivot, 3);
  }
}
