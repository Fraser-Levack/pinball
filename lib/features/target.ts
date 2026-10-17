import { COLOR, alpha, capsule, line } from "../draw";
import type { Game } from "../game";
import { type Ball, type Vec, collideCapsule } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

const MIN_IMPACT = 40; // ignore a ball just resting against a target

/** Fixed target that lights when struck and stays lit until its group completes. */
export class StandupTarget extends Feature {
  lit = false;
  private flash = 0;

  constructor(public a: Vec, public b: Vec, opts: FeatureOptions = {}) {
    super({ points: 250, sound: "target", color: COLOR.standups, ...opts });
  }

  collide(g: Game, ball: Ball) {
    const hit = collideCapsule(ball, this.a, this.b, 4, 0.6);
    if (hit && hit.impact > MIN_IMPACT) {
      this.lit = true;
      this.flash = 1;
      this.hit(g, ball);
    }
  }

  tick(_g: Game, dt: number) {
    this.flash = Math.max(0, this.flash - dt * 4);
  }

  reset() {
    this.lit = false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.lit || this.flash > 0) {
      ctx.strokeStyle = alpha(this.color, this.lit ? 0.6 : this.flash * 0.6);
      ctx.lineWidth = 7;
      line(ctx, this.a, this.b);
      ctx.lineWidth = 1.5;
    }
    ctx.strokeStyle = this.lit || this.flash > 0 ? this.color : alpha(this.color, 0.55);
    capsule(ctx, this.a, this.b, 4);
  }
}

/** Target that drops flat when struck (`lit` = down) and is out of play until its group resets it. */
export class DropTarget extends Feature {
  lit = false;

  constructor(public a: Vec, public b: Vec, opts: FeatureOptions = {}) {
    super({ points: 500, sound: "drop", color: COLOR.drops, ...opts });
  }

  collide(g: Game, ball: Ball) {
    if (this.lit) return;
    const hit = collideCapsule(ball, this.a, this.b, 4, 0.4);
    if (hit && hit.impact > MIN_IMPACT) {
      this.lit = true;
      this.hit(g, ball);
    }
  }

  reset() {
    this.lit = false;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.lit) {
      ctx.strokeStyle = alpha(this.color, 0.35);
      ctx.setLineDash([3, 4]);
      line(ctx, this.a, this.b);
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = alpha(this.color, 0.5);
      ctx.lineWidth = 7;
      line(ctx, this.a, this.b);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = this.color;
      capsule(ctx, this.a, this.b, 4);
    }
  }
}
