import { COLOR, alpha, circle, disc, label } from "../draw";
import type { Game } from "../game";
import type { Ball, Vec } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

/**
 * Sensor the ball rolls over. Hits once each time a ball enters it.
 * With `latch` (the default) it stays lit afterwards until its group completes or the game resets.
 */
export class Rollover extends Feature {
  lit = false;
  private flash = 0;
  private inside = new WeakSet<Ball>();
  private latch: boolean;
  private text?: string;

  constructor(public p: Vec, opts: FeatureOptions & { latch?: boolean; label?: string } = {}) {
    super({ points: 500, sound: "rollover", color: COLOR.wall, ...opts });
    this.latch = opts.latch ?? true;
    this.text = opts.label;
  }

  collide(g: Game, ball: Ball) {
    const dx = ball.x - this.p.x;
    const dy = ball.y - this.p.y;
    const over = dx * dx + dy * dy < 14 * 14;
    if (over && !this.inside.has(ball)) {
      this.inside.add(ball);
      if (this.latch) this.lit = true;
      this.flash = 1;
      this.hit(g, ball);
    } else if (!over) {
      this.inside.delete(ball);
    }
  }

  tick(_g: Game, dt: number) {
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  reset() {
    this.lit = false;
    this.inside = new WeakSet();
  }

  draw(ctx: CanvasRenderingContext2D) {
    const on = this.lit || this.flash > 0;
    disc(ctx, this.p, 8, alpha(this.color, this.lit ? 0.6 : 0.1 + this.flash * 0.5));
    ctx.strokeStyle = on ? this.color : alpha(this.color, 0.45);
    circle(ctx, this.p, 8);
    if (this.text) label(ctx, this.text, { x: this.p.x, y: this.p.y + 19 }, 12, on ? this.color : alpha(this.color, 0.45));
  }
}
