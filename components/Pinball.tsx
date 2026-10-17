"use client";

import { useEffect, useRef, useState } from "react";
import { H, W, createGame, startGame, stepGame } from "@/lib/game";
import { Input } from "@/lib/input";
import { render } from "@/lib/render";

const STEP = 1 / 120;

interface Hud {
  score: number;
  balls: number;
  high: number;
  gamepad: string | null;
}

function loadHigh(): number {
  try {
    return Number(localStorage.getItem("pinball-high")) || 0;
  } catch {
    return 0;
  }
}

function saveHigh(n: number) {
  try {
    localStorage.setItem("pinball-high", String(n));
  } catch {}
}

export default function Pinball() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<Hud>({ score: 0, balls: 3, high: 0, gamepad: null });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const game = createGame();
    const input = new Input();
    input.attach();
    let high = loadHigh();

    const resize = () => {
      const scale = Math.min((window.innerHeight - 32) / H, (window.innerWidth - 32) / W);
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      canvas.width = Math.round(W * scale * dpr);
      canvas.height = Math.round(H * scale * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let prevHud = "";
    let prevPhase = game.phase;
    let gameOverAt = -Infinity;

    const frame = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;

      const snap = input.poll();
      // Brief lockout after game over so a last-second flip doesn't instantly restart.
      const canStart = game.phase === "ready" || now - gameOverAt > 1500;
      if (snap.start && game.phase !== "playing" && canStart) startGame(game);

      while (acc >= STEP) {
        stepGame(game, snap, STEP);
        acc -= STEP;
      }

      for (const e of game.events) {
        if (e === "bumper") input.rumble(0.2, 0.6, 50);
        else if (e === "sling") input.rumble(0.1, 0.5, 40);
        else if (e === "flipper") input.rumble(0, 0.3, 25);
        else if (e === "launch") input.rumble(0.5, 0.2, 80);
        else if (e === "drain") input.rumble(0.8, 0.8, 300);
        else if (e === "bonus") input.rumble(0.4, 1, 250);
      }
      game.events.length = 0;

      if (game.score > high) high = game.score;
      if (game.phase === "gameover" && prevPhase === "playing") {
        saveHigh(high);
        gameOverAt = now;
      }
      prevPhase = game.phase;

      render(ctx, game, now / 1000);

      const next: Hud = { score: game.score, balls: game.balls, high, gamepad: snap.gamepad };
      const key = JSON.stringify(next);
      if (key !== prevHud) {
        prevHud = key;
        setHud(next);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      input.detach();
    };
  }, []);

  return (
    <div className="wrap">
      <canvas ref={canvasRef} />
      <div className="hud">
        <h1>WIREFRAME PINBALL</h1>
        <div className="dim">SCORE</div>
        <div className="big">{hud.score.toLocaleString()}</div>
        <div className="dim">BALLS</div>
        <div>{"● ".repeat(Math.max(0, hud.balls)) || "-"}</div>
        <div className="dim">HIGH</div>
        <div>{hud.high.toLocaleString()}</div>
        <div className="dim" style={{ marginTop: 12 }}>
          CONTROLLER
        </div>
        <div style={{ fontSize: 12 }}>{hud.gamepad ?? "none (press a button to connect)"}</div>
        <table className="dim">
          <tbody>
            <tr><td>Left flipper</td><td>LT (Z)</td></tr>
            <tr><td>Right flipper</td><td>RT (M)</td></tr>
            <tr><td>Plunger</td><td>hold both, release</td></tr>
            <tr><td>Start</td><td>either trigger</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
