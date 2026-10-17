import { BG, COLOR, alpha, disc } from "../draw";
import type { Game } from "../game";
import type { Ball, Vec } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

/** Shallow hole that catches the ball, holds it briefly, then kicks it out with velocity `eject`. */
export class Saucer extends Feature {
  held: Ball | null = null;
  private timer = 0;
  private hold: number;
  private ignoreUntil = new WeakMap<Ball, number>(); // so a just-ejected ball isn't caught again

  constructor(public p: Vec, public eject: Vec, opts: FeatureOptions & { hold?: number } = {}) {
    super({ points: 1000, sound: "saucer", color: COLOR.saucer, ...opts });
    this.hold = opts.hold ?? 1.2;
  }

  collide(g: Game, ball: Ball) {
    if (this.held || (this.ignoreUntil.get(ball) ?? -1) > g.time) return;
    const dx = ball.x - this.p.x;
    const dy = ball.y - this.p.y;
    if (dx * dx + dy * dy > 12 * 12) return;
    ball.held = true;
    ball.x = this.p.x;
    ball.y = this.p.y;
    ball.vx = 0;
    ball.vy = 0;
    this.held = ball;
    this.timer = this.hold;
    this.hit(g, ball);
  }

  tick(g: Game, dt: number) {
    if (!this.held) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const ball = this.held;
    ball.held = false;
    ball.vx = this.eject.x;
    ball.vy = this.eject.y;
    this.ignoreUntil.set(ball, g.time + 0.5);
    this.held = null;
    g.events.push("kick");
  }

  reset() {
    this.held = null;
  }

  draw(ctx: CanvasRenderingContext2D, _g: Game, time: number) {
    disc(ctx, this.p, 15, this.held ? alpha(this.color, 0.7 + 0.3 * Math.sin(time * 20)) : this.color);
    disc(ctx, this.p, 9, BG);
  }
}
