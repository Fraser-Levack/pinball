import { BG, FONT, INK, MONO, PALETTE, alpha, disc, label, line, roundRect, shade } from "./draw";
import { type Game, H, LANE_X, PLUNGER_Y, PLUNGER_TRAVEL, W, inShooterLane } from "./game";
import { BALL_R } from "./physics";
import { maskedGoal } from "./prompt/run";

type PanelLine = [text: string, size: number, color?: string];

/** Cream card with a coloured header band, for the start and game over screens. */
function panel(ctx: CanvasRenderingContext2D, y: number, header: string, headerColor: string, lines: PanelLine[]) {
  const headerH = 46;
  const h = lines.reduce((sum, [, size]) => sum + size * 1.7, headerH + 24);
  roundRect(ctx, 44, y + 6, 380, h, 16, alpha(INK, 0.15)); // flat drop shadow
  roundRect(ctx, 40, y, 380, h, 16, BG);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(40, y, 380, h, 16);
  ctx.clip();
  ctx.fillStyle = headerColor;
  ctx.fillRect(40, y, 380, headerH);
  ctx.restore();
  label(ctx, header, { x: 230, y: y + headerH / 2 + 1 }, 22, INK, 800);
  let cy = y + headerH + 12;
  for (const [text, size, color] of lines) {
    cy += size * 0.85;
    label(ctx, text, { x: 230, y: cy }, size, color ?? INK);
    cy += size * 0.85;
  }
}

/** Splits text into lines of at most `max` characters, breaking at spaces. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && cur.length + 1 + word.length > max) {
      lines.push(cur);
      cur = word;
    } else {
      cur = cur ? `${cur} ${word}` : word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * The prompt section being worked on, printed in the middle of the playfield: revealed letters
 * in ink, hidden ones as mint blocks, with a progress bar underneath.
 */
function drawGoal(ctx: CanvasRenderingContext2D, g: Game) {
  const goal = g.prompt.goal;
  if (!goal) return;
  const size = 15;
  ctx.font = `700 ${size}px ${MONO}`;
  const cw = ctx.measureText("M").width;
  const lines = wrap(maskedGoal(goal), Math.floor(320 / cw)).slice(0, 4);
  const lineH = size * 1.45;
  const top = 610 - (lines.length * lineH) / 2;

  label(ctx, `BUILDING: ${goal.section.toUpperCase()}`, { x: 230, y: top - 14 }, 11, shade(PALETTE.teal, 0.2), 800);

  ctx.font = `700 ${size}px ${MONO}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  lines.forEach((text, i) => {
    const y = top + i * lineH + lineH / 2;
    let x = 230 - (text.length * cw) / 2;
    for (const ch of text) {
      if (ch === "▒") {
        roundRect(ctx, x + 1, y - size * 0.42, cw - 2, size * 0.84, 2.5, alpha(PALETTE.mint, 0.35));
      } else {
        ctx.fillStyle = INK;
        ctx.fillText(ch, x, y + 1);
      }
      x += cw;
    }
  });

  const barY = top + lines.length * lineH + 8;
  const pct = goal.revealed / goal.letters;
  roundRect(ctx, 110, barY, 240, 8, 4, alpha(PALETTE.mint, 0.25));
  if (pct > 0) roundRect(ctx, 110, barY, Math.max(8, 240 * pct), 8, 4, PALETTE.mint);
}

export function render(ctx: CanvasRenderingContext2D, g: Game, time: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.5;

  // Drawn first so the ball and table pieces pass over it.
  if (g.phase === "playing") drawGoal(ctx, g);

  // Plunger, with a power bar that goes mint → yellow → pink as it's pulled back
  const py = PLUNGER_Y + g.plunger * PLUNGER_TRAVEL;
  ctx.save();
  ctx.strokeStyle = alpha(PALETTE.teal, 0.6);
  ctx.lineWidth = 3;
  ctx.beginPath();
  const coils = 6;
  for (let i = 0; i <= coils; i++) ctx.lineTo(i % 2 ? 452 : 468, py + ((H - py) * i) / coils);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  line(ctx, { x: LANE_X + 4, y: py }, { x: 476, y: py });
  ctx.restore();
  if (g.plunger > 0) {
    const color = g.plunger < 0.5 ? PALETTE.mint : g.plunger < 0.85 ? PALETTE.yellow : PALETTE.pink;
    roundRect(ctx, 484, H - 10 - g.plunger * 200, 9, g.plunger * 200, 4, color);
  }

  for (const f of g.features) f.draw(ctx, g, time);

  if (g.phase === "playing") {
    for (const b of g.balls) {
      disc(ctx, b, BALL_R, INK);
      // Highlight that rolls with the ball so you can see it spin
      const a = (b.x + b.y) / BALL_R;
      disc(ctx, { x: b.x + Math.cos(a) * BALL_R * 0.45, y: b.y + Math.sin(a) * BALL_R * 0.45 }, 2.5, BG);
    }

    // Revealed letters (or points) floating up from where they were scored
    for (const p of g.popups) {
      ctx.font = `800 16px ${MONO}`;
      const w = ctx.measureText(p.text).width + 14;
      ctx.globalAlpha = Math.min(1, p.time * 2);
      roundRect(ctx, p.x - w / 2, p.y - 12, w, 24, 12, p.color === INK ? PALETTE.mint : p.color);
      ctx.font = `800 16px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = INK;
      ctx.fillText(p.text, p.x, p.y + 1);
      ctx.globalAlpha = 1;
    }

    const msg = g.messages[0];
    if (msg) {
      ctx.font = `800 16px ${FONT}`;
      const w = ctx.measureText(msg.text).width + 32;
      roundRect(ctx, 230 - w / 2, 540, w, 32, 16, msg.color ?? PALETTE.yellow);
      label(ctx, msg.text, { x: 230, y: 557 }, 16, INK, 800);
    }

    // Launch help while a ball is waiting on the plunger
    if (g.balls.some((b) => inShooterLane(b) && b.vy >= 0)) {
      if (g.plunger > 0) {
        label(ctx, `POWER ${Math.round(g.plunger * 100)}%  -  LET GO TO LAUNCH`, { x: 230, y: 700 }, 13);
      } else if (Math.floor(time * 2) % 2 === 0) {
        label(ctx, "HOLD BOTH TRIGGERS (Z + M) TO PULL", { x: 230, y: 700 }, 13);
        label(ctx, "the plunger, then let go  ▶", { x: 230, y: 718 }, 11, alpha(INK, 0.7), 500);
      }
    }
  }

  const blink = (c: string) => (Math.floor(time * 2) % 2 ? shade(c, 0.35) : alpha(PALETTE.mint, 0.6));
  if (g.phase === "ready") {
    panel(ctx, 540, "HOW TO PLAY", PALETTE.yellow, [
      ["Every score reveals letters of your AI prompt.", 13, shade(PALETTE.teal, 0.2)],
      ["Finish a section to add it to the prompt.", 13, shade(PALETTE.teal, 0.2)],
      ["You get one ball: keep it between the flippers.", 12],
      ["Flippers: LT / RT  (keys Z / M)", 12],
      ["Launch: hold both, then let go", 12],
      ["PULL A TRIGGER TO START", 16, blink(PALETTE.mint)],
    ]);
  }
  if (g.phase === "gameover") {
    panel(ctx, 560, "GAME OVER", PALETTE.pink, [
      [`SCORE ${g.score.toLocaleString()}`, 18],
      ...(g.prompt.started ? ([["Your prompt is ready: copy it on the right", 12, shade(PALETTE.teal, 0.2)]] as PanelLine[]) : []),
      ["PULL A TRIGGER TO PLAY AGAIN", 14, blink(PALETTE.mint)],
    ]);
  }
}
