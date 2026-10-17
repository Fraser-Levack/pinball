import { BRIGHT, COLOR, DIM, alpha, circle, label, line } from "./draw";
import { type Game, H, LANE_X, PLUNGER_Y, PLUNGER_TRAVEL, W, inShooterLane } from "./game";
import { BALL_R } from "./physics";

const LINE_SOFT = alpha(COLOR.wall, 0.6);

/** Dark panel with lines of text, for the start and game over screens. */
function panel(ctx: CanvasRenderingContext2D, y: number, lines: [string, number, string?][]) {
  const h = lines.reduce((sum, [, size]) => sum + size * 1.6, 24);
  ctx.fillStyle = "rgba(0,0,0,0.85)";
  ctx.fillRect(40, y, 380, h);
  ctx.strokeStyle = LINE_SOFT;
  ctx.strokeRect(40, y, 380, h);
  let cy = y + 12;
  for (const [text, size, color] of lines) {
    cy += size * 0.8;
    label(ctx, text, { x: 230, y: cy }, size, color ?? BRIGHT);
    cy += size * 0.8;
  }
}

export function render(ctx: CanvasRenderingContext2D, g: Game, time: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.lineJoin = "round";

  // Faint grid for that wireframe feel
  ctx.strokeStyle = "#071a07";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 25) line(ctx, { x, y: 0 }, { x, y: H });
  for (let y = 0; y <= H; y += 25) line(ctx, { x: 0, y }, { x: W, y });
  ctx.lineWidth = 1.5;

  // Plunger, with a power bar that goes green → yellow → red as it's pulled back
  const py = PLUNGER_Y + g.plunger * PLUNGER_TRAVEL;
  ctx.strokeStyle = COLOR.flipper;
  line(ctx, { x: LANE_X, y: py }, { x: 480, y: py });
  ctx.strokeStyle = DIM;
  ctx.beginPath();
  const coils = 6;
  for (let i = 0; i <= coils; i++) ctx.lineTo(i % 2 ? 452 : 468, py + ((H - py) * i) / coils);
  ctx.stroke();
  if (g.plunger > 0) {
    ctx.fillStyle = `hsl(${120 - g.plunger * 120}, 90%, 55%)`;
    ctx.fillRect(484, H - 10 - g.plunger * 200, 8, g.plunger * 200);
  }

  for (const f of g.features) f.draw(ctx, g, time);

  if (g.phase === "playing") {
    ctx.strokeStyle = "#fff";
    for (const b of g.balls) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, b, BALL_R);
      // Spoke so you can see it roll
      const a = (b.x + b.y) / BALL_R;
      line(ctx, b, { x: b.x + Math.cos(a) * BALL_R, y: b.y + Math.sin(a) * BALL_R });
    }

    for (const p of g.popups) label(ctx, p.text, p, 13, alpha(p.color, Math.min(1, p.time * 2)));

    const msg = g.messages[0];
    if (msg && Math.floor(time * 8) % 4 !== 0) label(ctx, msg.text, { x: 230, y: 610 }, 20, msg.color ?? BRIGHT);

    // Launch help while a ball is waiting on the plunger
    if (g.balls.some((b) => inShooterLane(b) && b.vy >= 0)) {
      if (g.plunger > 0) {
        label(ctx, `POWER ${Math.round(g.plunger * 100)}%  -  LET GO TO LAUNCH`, { x: 230, y: 650 }, 13);
      } else if (Math.floor(time * 2) % 2 === 0) {
        label(ctx, "HOLD BOTH TRIGGERS (Z + M) TO PULL", { x: 230, y: 650 }, 13);
        label(ctx, "the plunger, then let go  ▶", { x: 230, y: 668 }, 11, alpha(BRIGHT, 0.7));
      }
    }
  }

  if (g.phase === "ready") {
    panel(ctx, 545, [
      ["HOW TO PLAY", 22, COLOR.lanes],
      ["Keep the ball from falling", 13],
      ["between the flippers.", 13],
      ["Flippers: LT / RT  (keys Z / M)", 13, COLOR.flipper],
      ["Launch: hold both, then let go", 13, COLOR.flipper],
      ["Hit the coloured things to score.", 13],
      ["Every score reveals letters of your AI prompt.", 12, COLOR.save],
      ["The list on the right shows what to aim for.", 11, alpha(BRIGHT, 0.7)],
      ["PULL A TRIGGER TO START", 16, Math.floor(time * 2) % 2 ? COLOR.save : alpha(COLOR.save, 0.4)],
    ]);
  }
  if (g.phase === "gameover") {
    panel(ctx, 570, [
      ["GAME OVER", 30, "#f66"],
      [`SCORE ${g.score.toLocaleString()}`, 18],
      ...(g.prompt.started ? ([["Your prompt is ready: copy it on the right", 12, COLOR.save]] as [string, number, string][]) : []),
      ["PULL A TRIGGER TO PLAY AGAIN", 14, Math.floor(time * 2) % 2 ? COLOR.save : alpha(COLOR.save, 0.4)],
    ]);
  }
}
