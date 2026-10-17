// The playfield: where every feature sits and what it does when hit.
//
// To add something to the table:
//   1. Create a feature from lib/features (or write a new class extending Feature).
//      Give it a colour from COLOR (lib/draw.ts) and a sound (lib/sound.ts) if you like.
//   2. Attach behaviour with `.onHit((g, feature, ball) => { ... })`. Handy things to do in there:
//        award(g, n), showMessage(g, "TEXT"), g.flags.something = true, startMultiball(g),
//        after(g, seconds, fn), g.events.push("goal") for a sound,
//        or push the ball (ball.vx / ball.vy).
//   3. Add it to the list returned at the bottom of buildTable().
// Use onAllLit() to do something when a whole set of rollovers/targets has been made.

import { COLOR, alpha } from "./draw";
import { PopBumper } from "./features/bumper";
import { type Feature } from "./features/feature";
import { Flipper } from "./features/flipper";
import { LaneChange, type Lightable, onAllLit } from "./features/group";
import { Hint, Light } from "./features/light";
import { Rollover } from "./features/rollover";
import { Saucer } from "./features/saucer";
import { Spinner } from "./features/spinner";
import { DropTarget, StandupTarget } from "./features/target";
import { OneWayGate, Slingshot, Walls } from "./features/walls";
import { LANE_X, PLUNGER_Y, award, showMessage, startMultiball } from "./game";
import { type Vec, v } from "./physics";

export interface Table {
  features: Feature[];
}

// Mirror a point left↔right around the playfield centre (x = 230).
const mirror = (p: Vec): Vec => v(20 + LANE_X - p.x, p.y);
const mirrorAll = (ps: Vec[]): Vec[] => ps.map(mirror);
const countLit = (fs: Lightable[]) => fs.filter((f) => f.lit).length;

const TOP_LANE_WORD = "PROMPT";

function topArch(): Vec[] {
  const arc: Vec[] = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = Math.PI + (Math.PI * i) / N;
    arc.push(v(250 + 230 * Math.cos(t), 250 + 230 * Math.sin(t)));
  }
  return arc;
}

export function buildTable(): Table {
  // ---------------- Structure ----------------

  // No outlanes: the sides slope straight down into the flippers, so only the centre drains.
  // The funnel ends just above the flipper's pivot so the ball rolls straight onto the flipper.
  // Ending it beside the pivot leaves a dip between the two rounded ends where a ball can sit forever.
  const flipperPivot = v(145, 880);
  const leftFunnel = [v(20, 250), v(20, 799), v(flipperPivot.x, flipperPivot.y - 9)];
  const walls = new Walls([
    topArch(),
    leftFunnel, // left side
    [v(480, 250), v(480, PLUNGER_Y)], // right side
    [v(LANE_X, 260), v(LANE_X, PLUNGER_Y)], // shooter lane divider, also the playfield's right side
    [mirror(leftFunnel[1]), mirror(leftFunnel[2])], // right funnel
    [v(62, 300), v(62, 520)], // inner wall of the left orbit
  ]);
  // P-R-O-M-P-T lanes across the top. The divider tops sit on a curve inside the arch so the
  // lanes fan round with it, and so a launched ball crossing the top right passes over them.
  const laneDividerX = Array.from({ length: TOP_LANE_WORD.length + 1 }, (_, i) => 130 + i * 40);
  const laneTop = (x: number) => 250 - Math.sqrt(170 * 170 - (x - 250) ** 2);
  const topLaneDividers = new Walls(
    laneDividerX.map((x) => [v(x, laneTop(x)), v(x, laneTop(x) + 40)]),
    { r: 3, color: COLOR.lanes },
  );

  // Lets the ball out of the shooter lane but not back in.
  const shooterGate = new OneWayGate(v(LANE_X, 260), v(478, 222), v(460, 300));

  const sling: [Vec, Vec, Vec] = [v(85, 700), v(85, 790), v(128, 820)];
  const slingshots = [new Slingshot(sling), new Slingshot(mirrorAll(sling) as [Vec, Vec, Vec])];

  const bumpers = [v(165, 230), v(295, 230), v(230, 320)].map((p) => new PopBumper(p));

  const flippers = [new Flipper(flipperPivot, "left"), new Flipper(mirror(flipperPivot), "right")];

  // ---------------- Scoring features and rules ----------------

  // Yellow top lanes: light all six to raise the end-of-ball bonus multiplier.
  // The flipper buttons rotate which lanes are lit.
  const topLanes = [...TOP_LANE_WORD].map(
    (letter, i) =>
      new Rollover(v(laneDividerX[i] + 20, (laneTop(laneDividerX[i]) + laneTop(laneDividerX[i + 1])) / 2 + 16), {
        label: letter,
        bonus: 100,
        color: COLOR.lanes,
      }),
  );
  onAllLit(topLanes, (g) => {
    award(g, 5000);
    g.multiplier = Math.min(5, g.multiplier + 1);
    showMessage(g, `BONUS NOW ${g.multiplier}X`, { color: COLOR.lanes });
    g.events.push("goal");
  });

  // Orange drop targets: knock them all down to light the lock (multiball) at the saucer.
  const dropTargets = [390, 425, 460, 495].map((y) => new DropTarget(v(400, y), v(400, y + 28), { bonus: 200 }));
  onAllLit(
    dropTargets,
    (g) => {
      award(g, 5000);
      g.flags.lock = true;
      showMessage(g, "LOCK LIT: SHOOT THE SAUCER", { color: COLOR.drops, seconds: 2.2 });
      g.events.push("goal");
    },
    0.6,
  );

  // Blue standup targets: light all three for a points award.
  const standups = [340, 385, 430].map((y) => new StandupTarget(v(72, y), v(72, y + 28), { bonus: 100 }));
  onAllLit(standups, (g) => {
    award(g, 2500);
    showMessage(g, "TARGETS COMPLETE", { color: COLOR.standups });
    g.events.push("goal");
  });

  // Purple spinner in the left orbit: points for every half turn.
  const spinner = new Spinner(v(22, 420), v(60, 420), { bonus: 10 });

  // Pink saucer: starts multiball when the lock is lit.
  const saucer = new Saucer(v(230, 480), v(140, -650), { bonus: 500 }).onHit((g) => {
    if (g.flags.lock) {
      g.flags.lock = false;
      startMultiball(g);
    }
  });

  const inlanes = [v(68, 760), mirror(v(68, 760))].map((p) => new Rollover(p, { latch: false, bonus: 50 }));

  // ---------------- Lights and hints ----------------

  // Insert lights, coloured to match whatever lights them.
  const lights = [
    ...[2, 3, 4, 5].map(
      (n, i) => new Light(v(190 + i * 40, 164), `${n}X`, { color: COLOR.lanes, lit: (g) => g.multiplier >= n }),
    ),
    new Light(v(230, 515), "LOCK", { color: COLOR.drops, lit: (g) => !!g.flags.lock }),
  ];

  // Words on the playfield telling new players what each thing is for.
  const hints = [
    new Hint(v(250, 200), () => `ROLL OVER ${[...TOP_LANE_WORD].join("-")}  ${countLit(topLanes)}/${topLanes.length}`, {
      color: COLOR.lanes,
      size: 9,
    }),
    new Hint(v(400, 360), (g) => (g.flags.lock ? "LOCK\nLIT" : `HIT ALL\n${countLit(dropTargets)}/4`), {
      color: COLOR.drops,
    }),
    new Hint(v(95, 312), () => `HIT ALL\n${countLit(standups)}/3`, { color: COLOR.standups }),
    new Hint(
      v(230, 446),
      (g) => (g.flags.lock ? "▼ MULTIBALL ▼" : null),
      { color: COLOR.saucer, size: 12, blink: true },
    ),
    new Hint(v(41, 538), () => "▲\nORBIT", { color: COLOR.spinner, size: 9 }),
    new Hint(v(150, 945), () => "LT / Z", { color: alpha(COLOR.flipper, 0.4) }),
    new Hint(v(310, 945), () => "RT / M", { color: alpha(COLOR.flipper, 0.4) }),
  ];

  // Drawn in this order, so lights go underneath and flippers on top.
  const features = [
    ...lights,
    ...hints,
    walls,
    topLaneDividers,
    shooterGate,
    ...slingshots,
    ...bumpers,
    ...topLanes,
    new LaneChange(topLanes),
    ...dropTargets,
    ...standups,
    spinner,
    saucer,
    ...inlanes,
    ...flippers,
  ];
  return { features };
}
