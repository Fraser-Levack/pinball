// Base class for everything on the playfield. A feature can take part in physics
// (step/collide), keep time (tick), draw itself, and fire hit handlers when the ball
// does whatever counts as a "hit" for it.

import { LINE } from "../draw";
import { type Game, award } from "../game";
import type { Ball } from "../physics";

export type HitHandler<F extends Feature = Feature> = (g: Game, feature: F, ball: Ball) => void;

export interface FeatureOptions {
  points?: number; // score per hit
  bonus?: number; // added to the end-of-ball bonus per hit
  sound?: string; // game event sent on each hit: plays a sound (lib/sound.ts) and rumbles (components/Pinball.tsx)
  color?: string; // see COLOR in lib/draw.ts
  popup?: boolean; // float the points scored up from the ball (default true)
}

export abstract class Feature {
  points: number;
  bonus: number;
  sound?: string;
  color: string;
  popup: boolean;
  private handlers: HitHandler<any>[] = [];

  constructor(opts: FeatureOptions = {}) {
    this.points = opts.points ?? 0;
    this.bonus = opts.bonus ?? 0;
    this.sound = opts.sound;
    this.color = opts.color ?? LINE;
    this.popup = opts.popup ?? true;
  }

  /** Run `fn` every time this feature is hit. Chainable; handlers run in the order added. */
  onHit(fn: HitHandler<this>): this {
    this.handlers.push(fn);
    return this;
  }

  /** Subclasses call this when the ball hits them: scores, plays its sound, then runs the handlers. */
  protected hit(g: Game, ball: Ball) {
    const letters = award(g, this.points);
    g.bonus += this.bonus;
    if (this.sound) g.events.push(this.sound);
    // The letters this hit revealed float up from the ball, so you can see the prompt being built.
    if (this.popup && letters) {
      g.popups.push({ x: ball.x, y: ball.y - 18, text: letters, color: this.color, time: 0.9 });
    } else if (this.popup && this.points >= 50) {
      g.popups.push({ x: ball.x, y: ball.y - 16, text: `+${this.points}`, color: this.color, time: 0.9 });
    }
    for (const h of this.handlers) h(g, this, ball);
  }

  /** Every physics substep, before balls move. */
  step?(g: Game, dt: number): void;
  /** Every physics substep, for each ball in play. */
  collide?(g: Game, ball: Ball): void;
  /** Once per frame, after physics. */
  tick?(g: Game, dt: number): void;
  /** At the start of each game. */
  reset?(g: Game): void;

  abstract draw(ctx: CanvasRenderingContext2D, g: Game, time: number): void;
}
