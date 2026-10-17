// Helpers for rules that span several features.

import { after, type Game } from "../game";
import { Feature } from "./feature";

/** Anything that can be "made": a lit rollover or standup, a dropped drop target. */
export type Lightable = Feature & { lit: boolean };

/**
 * Calls `onComplete` when every member is lit, then resets them (after `resetDelay`
 * seconds, so a drop target doesn't pop up under the ball) so the set can be made again.
 */
export function onAllLit(members: Lightable[], onComplete: (g: Game) => void, resetDelay = 0) {
  for (const m of members) {
    m.onHit((g) => {
      if (!members.every((o) => o.lit)) return;
      onComplete(g);
      const clear = () => members.forEach((o) => (o.lit = false));
      if (resetDelay > 0) after(g, resetDelay, clear);
      else clear();
    });
  }
}

/** Lets the flipper buttons rotate which members are lit, so the player can steer toward an unlit one. */
export class LaneChange extends Feature {
  constructor(private lanes: Lightable[]) {
    super();
  }

  tick(g: Game) {
    if (g.phase !== "playing") return;
    const lit = this.lanes.map((l) => l.lit);
    const n = lit.length;
    if (g.controls.left && !g.prevControls.left) this.lanes.forEach((l, i) => (l.lit = lit[(i + 1) % n]));
    if (g.controls.right && !g.prevControls.right) this.lanes.forEach((l, i) => (l.lit = lit[(i + n - 1) % n]));
  }

  draw() {}
}
