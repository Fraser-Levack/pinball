import { COLOR, alpha, circle, disc } from "../draw";
import type { Game } from "../game";
import { type Ball, type Vec, collideCircle } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

/** Round bumper that fires the ball away on contact. */
export class PopBumper extends Feature {
  private flash = 0;

  constructor(public p: Vec, public r = 24, opts: FeatureOptions = {}) {
    super({ points: 100, sound: "bumper", color: COLOR.bumper, ...opts });
  }

  collide(g: Game, ball: Ball) {
    const hit = collideCircle(ball, this.p, this.r, 0.8);
    if (!hit) return;
    ball.vx += hit.nx * 380;
    ball.vy += hit.ny * 380;
    this.flash = 1;
    this.hit(g, ball);
  }

  tick(_g: Game, dt: number) {
    this.flash = Math.max(0, this.flash - dt * 4);
  }

  draw(ctx: CanvasRenderingContext2D) {
    disc(ctx, this.p, this.r, alpha(this.color, 0.12 + this.flash * 0.5));
    ctx.strokeStyle = this.flash > 0 ? "#fff" : this.color;
    circle(ctx, this.p, this.r);
    circle(ctx, this.p, this.r * 0.55);
  }
}
