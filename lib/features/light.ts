import { COLOR, alpha, circle, disc, label } from "../draw";
import type { Game } from "../game";
import type { Vec } from "../physics";
import { Feature } from "./feature";

export interface LightOptions {
  color?: string;
  lit: (g: Game) => boolean;
  blink?: (g: Game) => boolean;
}

/** Playfield insert showing whether a rule is active. Decorative: the ball rolls straight over it. */
export class Light extends Feature {
  private isLit: (g: Game) => boolean;
  private isBlinking: (g: Game) => boolean;

  constructor(public p: Vec, public text: string, opts: LightOptions) {
    super({ color: opts.color ?? COLOR.wall });
    this.isLit = opts.lit;
    this.isBlinking = opts.blink ?? (() => false);
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, time: number) {
    const lit = this.isLit(g);
    const on = lit && !(this.isBlinking(g) && Math.floor(time * 6) % 2 === 0);
    if (on) disc(ctx, this.p, 9, alpha(this.color, 0.25));
    disc(ctx, this.p, 5, on ? this.color : alpha(this.color, 0.12));
    ctx.strokeStyle = alpha(this.color, on ? 1 : 0.4);
    circle(ctx, this.p, 5);
    label(ctx, this.text, { x: this.p.x, y: this.p.y + 15 }, 10, alpha(this.color, lit ? 1 : 0.4));
  }
}

export interface HintOptions {
  color?: string;
  size?: number;
  blink?: boolean;
}

/** Text printed on the playfield to tell the player what to do; `text` returns null to hide it. */
export class Hint extends Feature {
  private size: number;
  private blink: boolean;

  constructor(public p: Vec, private text: (g: Game) => string | null, opts: HintOptions = {}) {
    super({ color: opts.color ?? COLOR.wall });
    this.size = opts.size ?? 10;
    this.blink = opts.blink ?? false;
  }

  draw(ctx: CanvasRenderingContext2D, g: Game, time: number) {
    if (g.phase !== "playing") return;
    const text = this.text(g);
    if (!text || (this.blink && Math.floor(time * 4) % 2 === 0)) return;
    label(ctx, text, this.p, this.size, this.color);
  }
}
