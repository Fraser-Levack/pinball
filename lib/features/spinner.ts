import { COLOR, INK, disc, shade } from "../draw";
import type { Game } from "../game";
import { type Ball, type Vec, side } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

/** Flap across a lane that spins when a ball passes through it, hitting on every half turn. */
export class Spinner extends Feature {
  private angle = 0;
  private speed = 0; // rad/s
  private sides = new WeakMap<Ball, number>();
  private lastBall: Ball | null = null;

  constructor(public a: Vec, public b: Vec, opts: FeatureOptions = {}) {
    super({ points: 100, sound: "spinner", color: COLOR.spinner, popup: false, ...opts });
  }

  collide(_g: Game, ball: Ball) {
    const s = Math.sign(side(ball, this.a, this.b));
    const prev = this.sides.get(ball);
    this.sides.set(ball, s);
    if (prev === undefined || s === 0 || prev === s) return;

    // Crossed the line; only counts if it went through the flap itself.
    const abx = this.b.x - this.a.x;
    const aby = this.b.y - this.a.y;
    const t = ((ball.x - this.a.x) * abx + (ball.y - this.a.y) * aby) / (abx * abx + aby * aby);
    if (t < 0 || t > 1) return;

    this.speed = Math.max(this.speed, Math.min(60, Math.hypot(ball.vx, ball.vy) / 15));
    this.lastBall = ball;
  }

  tick(g: Game, dt: number) {
    if (this.speed === 0) return;
    this.angle += this.speed * dt;
    while (this.angle >= Math.PI) {
      this.angle -= Math.PI;
      if (this.lastBall) this.hit(g, this.lastBall);
    }
    this.speed *= Math.exp(-1.5 * dt);
    if (this.speed < 1) this.speed = 0;
  }

  reset() {
    this.speed = 0;
    this.angle = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    // Seen from above, the flap's width shrinks and grows as it turns.
    const len = Math.hypot(this.b.x - this.a.x, this.b.y - this.a.y);
    const nx = -(this.b.y - this.a.y) / len;
    const ny = (this.b.x - this.a.x) / len;
    const w = Math.abs(Math.sin(this.angle)) * 6 + 0.5;
    ctx.fillStyle = this.speed > 0 ? shade(this.color, 0.2) : this.color;
    ctx.beginPath();
    ctx.moveTo(this.a.x + nx * w, this.a.y + ny * w);
    ctx.lineTo(this.b.x + nx * w, this.b.y + ny * w);
    ctx.lineTo(this.b.x - nx * w, this.b.y - ny * w);
    ctx.lineTo(this.a.x - nx * w, this.a.y - ny * w);
    ctx.closePath();
    ctx.fill();
    disc(ctx, this.a, 3, INK);
    disc(ctx, this.b, 3, INK);
  }
}
