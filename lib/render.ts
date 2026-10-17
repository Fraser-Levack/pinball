import { BALL_R, Game, H, Vec, W, flipperTip } from "./game";

const LINE = "#3c3";
const BRIGHT = "#cfc";
const DIM = "#163";

function capsule(ctx: CanvasRenderingContext2D, a: Vec, b: Vec, r: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  ctx.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, a: Vec, b: Vec) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, p: Vec, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function centerText(ctx: CanvasRenderingContext2D, text: string, y: number, size: number) {
  ctx.font = `${size}px ui-monospace, Consolas, monospace`;
  ctx.textAlign = "center";
  ctx.fillStyle = BRIGHT;
  ctx.fillText(text, 230, y);
}

export function render(ctx: CanvasRenderingContext2D, g: Game, time: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";

  // Faint grid for that wireframe feel
  ctx.strokeStyle = "#071a07";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 25) line(ctx, { x, y: 0 }, { x, y: H });
  for (let y = 0; y <= H; y += 25) line(ctx, { x: 0, y }, { x: W, y });
  ctx.lineWidth = 1.5;

  for (const w of g.walls) {
    ctx.strokeStyle = w.flash > 0 ? BRIGHT : LINE;
    if (w.r > 2) capsule(ctx, w.a, w.b, w.r);
    else line(ctx, w.a, w.b);
  }

  // Plunger
  const pw = g.plungerWall;
  ctx.strokeStyle = LINE;
  line(ctx, pw.a, pw.b);
  ctx.strokeStyle = DIM;
  ctx.beginPath();
  const coils = 6;
  for (let i = 0; i <= coils; i++) {
    const y = pw.a.y + ((H - pw.a.y) * i) / coils;
    ctx.lineTo(i % 2 ? 452 : 468, y);
  }
  ctx.stroke();
  if (g.plunger > 0) {
    ctx.fillStyle = LINE;
    ctx.fillRect(484, H - 10 - g.plunger * 200, 8, g.plunger * 200);
  }

  for (const b of g.bumpers) {
    ctx.strokeStyle = b.flash > 0 ? BRIGHT : LINE;
    if (b.flash > 0) {
      ctx.fillStyle = `rgba(150,255,150,${b.flash * 0.4})`;
      ctx.beginPath();
      ctx.arc(b.p.x, b.p.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    circle(ctx, b.p, b.r);
    circle(ctx, b.p, b.r * 0.55);
  }

  for (const r of g.rollovers) {
    ctx.strokeStyle = r.lit ? BRIGHT : DIM;
    if (r.lit) {
      ctx.fillStyle = "rgba(150,255,150,0.3)";
      ctx.beginPath();
      ctx.arc(r.p.x, r.p.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    circle(ctx, r.p, 8);
  }

  for (const f of g.flippers) {
    ctx.strokeStyle = f.angle !== f.rest ? BRIGHT : LINE;
    capsule(ctx, f.pivot, flipperTip(f), f.r);
    circle(ctx, f.pivot, 3);
  }

  if (g.phase === "playing") {
    const b = g.ball;
    ctx.strokeStyle = "#fff";
    circle(ctx, b, BALL_R);
    // Spoke so you can see it roll
    const a = (b.x + b.y) / BALL_R;
    line(ctx, b, { x: b.x + Math.cos(a) * BALL_R, y: b.y + Math.sin(a) * BALL_R });
  }

  if (g.bonusFlash > 0 && Math.floor(time * 8) % 2 === 0) centerText(ctx, "LANES BONUS +5000", 420, 20);
  if (g.phase === "ready") {
    centerText(ctx, "PULL A TRIGGER", 440, 28);
    centerText(ctx, "hold both triggers to launch", 470, 14);
  }
  if (g.phase === "gameover") {
    centerText(ctx, "GAME OVER", 420, 32);
    centerText(ctx, `SCORE ${g.score}`, 455, 18);
    centerText(ctx, "PULL A TRIGGER", 490, 14);
  }
}
