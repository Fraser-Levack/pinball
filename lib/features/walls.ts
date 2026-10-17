import { COLOR, alpha, capsule, line } from "../draw";
import type { Game } from "../game";
import { type Ball, type Vec, collideCapsule, side } from "../physics";
import { Feature, type FeatureOptions } from "./feature";

/** Plain static walls, given as polylines. */
export class Walls extends Feature {
  private segs: [Vec, Vec][] = [];
  private r: number;
  private restitution: number;

  constructor(chains: Vec[][], opts: { r?: number; restitution?: number; color?: string } = {}) {
    super({ color: opts.color ?? COLOR.wall });
    this.r = opts.r ?? 2;
    this.restitution = opts.restitution ?? 0.5;
    for (const pts of chains) for (let i = 0; i < pts.length - 1; i++) this.segs.push([pts[i], pts[i + 1]]);
  }

  collide(_g: Game, ball: Ball) {
    for (const [a, b] of this.segs) collideCapsule(ball, a, b, this.r, this.restitution);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = this.color;
    for (const [a, b] of this.segs) {
      if (this.r > 2) capsule(ctx, a, b, this.r);
      else line(ctx, a, b);
    }
  }
}

/** Triangle a-b-c whose long face c→a kicks the ball away when struck. */
export class Slingshot extends Feature {
  private flash = 0;
  private kick: number;

  constructor(private pts: [Vec, Vec, Vec], opts: FeatureOptions & { kick?: number } = {}) {
    super({ points: 10, sound: "sling", color: COLOR.bumper, ...opts });
    this.kick = opts.kick ?? 420;
  }

  collide(g: Game, ball: Ball) {
    const [a, b, c] = this.pts;
    collideCapsule(ball, a, b, 3, 0.5);
    collideCapsule(ball, b, c, 3, 0.5);
    const hit = collideCapsule(ball, c, a, 3, 0.6);
    if (hit && hit.impact > 60) {
      ball.vx += hit.nx * this.kick;
      ball.vy += hit.ny * this.kick;
      this.flash = 1;
      this.hit(g, ball);
    }
  }

  tick(_g: Game, dt: number) {
    this.flash = Math.max(0, this.flash - dt * 4);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const [a, b, c] = this.pts;
    ctx.fillStyle = alpha(this.color, 0.08 + this.flash * 0.4);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.fill();
    ctx.strokeStyle = alpha(this.color, 0.6);
    capsule(ctx, a, b, 3);
    capsule(ctx, b, c, 3);
    ctx.strokeStyle = this.flash > 0 ? "#fff" : this.color;
    capsule(ctx, c, a, 3);
  }
}

/** Wall that balls can pass through from the side `passFrom` is on, but not back the other way. */
export class OneWayGate extends Feature {
  private passSide: number;

  constructor(private a: Vec, private b: Vec, passFrom: Vec) {
    super({ color: COLOR.wall });
    this.passSide = Math.sign(side(passFrom, a, b));
  }

  collide(_g: Game, ball: Ball) {
    if (Math.sign(side(ball, this.a, this.b)) === this.passSide) return;
    collideCapsule(ball, this.a, this.b, 2, 0.4);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = this.color;
    line(ctx, this.a, this.b);
  }
}
