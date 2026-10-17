// The playfield: where every feature sits and what it does when hit.
//
// To add something to the table:
//   1. Create a feature from lib/features (or write a new class extending Feature).
//      Give it a colour from COLOR (lib/draw.ts) and a sound (lib/sound.ts) if you like.
//   2. Attach behaviour with `.onHit((g, feature, ball) => { ... })`. Handy things to do in there:
//        g.score += n, showMessage(g, "TEXT"), g.flags.something = true, startMultiball(g),
//        addExtraBall(g), after(g, seconds, fn), g.events.push("goal") for a sound,
//        or push the ball (ball.vx / ball.vy).
//   3. Add it to the list returned at the bottom of buildTable(), and a line to `goals`
//      if players should know about it.
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
import { type Game, H, LANE_X, PLUNGER_Y, addExtraBall, showMessage, startMultiball } from "./game";
import { type Vec, v } from "./physics";

/** One line of the "what to aim for" list next to the table. */
export interface Goal {
  color: string;
  text: string;
  status: string;
  ready?: boolean; // highlighted: something is lit and waiting to be collected
}

export interface Table {
  features: Feature[];
  goals: (g: Game) => Goal[];
}

// Mirror a point left↔right around the playfield centre (x = 230).
const mirror = (p: Vec): Vec => v(20 + LANE_X - p.x, p.y);
const mirrorAll = (ps: Vec[]): Vec[] => ps.map(mirror);
const countLit = (fs: Lightable[]) => fs.filter((f) => f.lit).length;

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

  const outlaneGuide = [v(52, 740), v(52, 820), v(136, 876)]; // splits the left outlane from the inlane
  const walls = new Walls([
    topArch(),
    [v(20, 250), v(20, H)], // left side, open at the bottom so the outlane drains
    [v(480, 250), v(480, PLUNGER_Y)], // right side
    [v(LANE_X, 260), v(LANE_X, PLUNGER_Y)], // shooter lane divider
    [v(62, 300), v(62, 520)], // inner wall of the left orbit
    outlaneGuide,
    mirrorAll(outlaneGuide),
  ]);
  const topLaneDividers = new Walls(
    [170, 220, 270, 320].map((x) => [v(x, 70), v(x, 110)]),
    { r: 3, color: COLOR.lanes },
  );

  // Lets the ball out of the shooter lane but not back in.
  const shooterGate = new OneWayGate(v(LANE_X, 260), v(478, 222), v(460, 300));

  const sling: [Vec, Vec, Vec] = [v(85, 700), v(85, 790), v(128, 820)];
  const slingshots = [new Slingshot(sling), new Slingshot(mirrorAll(sling) as [Vec, Vec, Vec])];

  const bumpers = [v(165, 230), v(295, 230), v(230, 320)].map((p) => new PopBumper(p));

  const flippers = [new Flipper(v(145, 880), "left"), new Flipper(mirror(v(145, 880)), "right")];

  // ---------------- Scoring features and rules ----------------

  // Yellow top lanes: light all three to raise the end-of-ball bonus multiplier.
  // The flipper buttons rotate which lanes are lit.
  const topLanes = [195, 245, 295].map(
    (x, i) => new Rollover(v(x, 90), { label: "PIN"[i], bonus: 100, color: COLOR.lanes }),
  );
  onAllLit(topLanes, (g) => {
    g.score += 5000;
    g.multiplier = Math.min(5, g.multiplier + 1);
    showMessage(g, `BONUS NOW ${g.multiplier}X`, { color: COLOR.lanes });
    g.events.push("goal");
  });

  // Orange drop targets: knock them all down to light the lock (multiball) at the saucer.
  // Every second clear also lights the extra ball.
  const dropTargets = [390, 425, 460, 495].map((y) => new DropTarget(v(400, y), v(400, y + 28), { bonus: 200 }));
  onAllLit(
    dropTargets,
    (g) => {
      g.score += 5000;
      g.flags.lock = true;
      showMessage(g, "LOCK LIT: SHOOT THE SAUCER", { color: COLOR.drops, seconds: 2.2 });
      g.counters.dropBanks = (g.counters.dropBanks ?? 0) + 1;
      if (g.counters.dropBanks % 2 === 0) {
        g.flags.extraBall = true;
        showMessage(g, "EXTRA BALL LIT", { color: COLOR.drops });
      }
      g.events.push("goal");
    },
    0.6,
  );

  // Blue standup targets: light all three to arm the left outlane kickback.
  const standups = [340, 385, 430].map((y) => new StandupTarget(v(72, y), v(72, y + 28), { bonus: 100 }));
  onAllLit(standups, (g) => {
    g.score += 2500;
    g.flags.kickback = true;
    showMessage(g, "KICKBACK READY", { color: COLOR.standups });
    g.events.push("goal");
  });

  // Purple spinner in the left orbit: points for every half turn.
  const spinner = new Spinner(v(22, 420), v(60, 420), { bonus: 10 });

  // Pink saucer: collects a lit extra ball and starts multiball when the lock is lit.
  const saucer = new Saucer(v(230, 480), v(140, -650), { bonus: 500 }).onHit((g) => {
    if (g.flags.extraBall) {
      g.flags.extraBall = false;
      addExtraBall(g);
    }
    if (g.flags.lock) {
      g.flags.lock = false;
      startMultiball(g);
    }
  });

  const inlanes = [v(68, 760), mirror(v(68, 760))].map((p) => new Rollover(p, { latch: false, bonus: 50 }));

  // Left outlane: a lit kickback fires the ball back up into play.
  const leftOutlane = new Rollover(v(36, 860), { latch: false, points: 2000 }).onHit((g, _f, ball) => {
    if (!g.flags.kickback) return;
    g.flags.kickback = false;
    ball.vx = 0;
    ball.vy = -1300;
    showMessage(g, "KICKBACK SAVED IT", { color: COLOR.standups });
    g.events.push("kickback");
  });
  const rightOutlane = new Rollover(mirror(v(36, 860)), { latch: false, points: 2000 });

  // ---------------- Lights and hints ----------------

  // Insert lights, coloured to match whatever lights them.
  const lights = [
    ...[2, 3, 4, 5].map(
      (n, i) => new Light(v(185 + i * 40, 145), `${n}X`, { color: COLOR.lanes, lit: (g) => g.multiplier >= n }),
    ),
    new Light(v(195, 515), "LOCK", { color: COLOR.drops, lit: (g) => !!g.flags.lock }),
    new Light(v(265, 515), "EXTRA BALL", { color: COLOR.drops, lit: (g) => !!g.flags.extraBall }),
    new Light(v(36, 905), "KICK", { color: COLOR.standups, lit: (g) => !!g.flags.kickback }),
    new Light(v(230, 960), "SHOOT AGAIN", {
      color: COLOR.save,
      lit: (g) => g.ballSave > 0,
      blink: (g) => g.ballSave < 3,
    }),
  ];

  // Words on the playfield telling new players what each thing is for.
  const hints = [
    new Hint(v(245, 182), () => `ROLL OVER P-I-N  ${countLit(topLanes)}/3`, { color: COLOR.lanes, size: 9 }),
    new Hint(v(400, 360), (g) => (g.flags.lock ? "LOCK\nLIT" : `HIT ALL\n${countLit(dropTargets)}/4`), {
      color: COLOR.drops,
    }),
    new Hint(v(95, 312), (g) => (g.flags.kickback ? "KICKBACK\nREADY" : `HIT ALL\n${countLit(standups)}/3`), {
      color: COLOR.standups,
    }),
    new Hint(
      v(230, 446),
      (g) => (g.flags.lock ? "▼ MULTIBALL ▼" : g.flags.extraBall ? "▼ EXTRA BALL ▼" : null),
      { color: COLOR.saucer, size: 12, blink: true },
    ),
    new Hint(v(41, 538), () => "▲\nORBIT", { color: COLOR.spinner, size: 9 }),
    new Hint(v(150, 945), () => "LT / Z", { color: alpha(COLOR.flipper, 0.4) }),
    new Hint(v(310, 945), () => "RT / M", { color: alpha(COLOR.flipper, 0.4) }),
  ];

  const goals = (g: Game): Goal[] => [
    {
      color: COLOR.lanes,
      text: "Roll over the yellow P-I-N lanes",
      status: g.multiplier >= 5 ? "bonus maxed at 5X" : `${countLit(topLanes)}/3 → bonus ${g.multiplier + 1}X`,
    },
    {
      color: COLOR.drops,
      text: "Knock down the orange targets",
      status: `${countLit(dropTargets)}/4 → lights LOCK`,
    },
    {
      color: COLOR.saucer,
      text: "Shoot the pink saucer",
      status: g.flags.lock ? "LOCK LIT → MULTIBALL!" : g.flags.extraBall ? "→ EXTRA BALL!" : "light LOCK first",
      ready: !!(g.flags.lock || g.flags.extraBall),
    },
    {
      color: COLOR.standups,
      text: "Hit the blue targets",
      status: g.flags.kickback ? "KICKBACK READY" : `${countLit(standups)}/3 → kickback`,
      ready: !!g.flags.kickback,
    },
    { color: COLOR.spinner, text: "Shoot up the left orbit", status: "spinner: 100 a spin" },
    { color: COLOR.bumper, text: "Red bumpers & slingshots", status: "keep it bouncing" },
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
    leftOutlane,
    rightOutlane,
    ...flippers,
  ];
  return { features, goals };
}
