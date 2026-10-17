"use client";

import { useEffect, useRef, useState } from "react";
import { H, W, createGame, startGame, stepGame } from "@/lib/game";
import { Input } from "@/lib/input";
import { maskedGoal, promptText } from "@/lib/prompt/run";
import { render } from "@/lib/render";
import { Sound } from "@/lib/sound";
import { type Goal, buildTable } from "@/lib/table";

const STEP = 1 / 120;

// Controller rumble per game event: [strong motor, weak motor, milliseconds].
const RUMBLE: Record<string, [number, number, number]> = {
  bumper: [0.2, 0.6, 50],
  sling: [0.1, 0.5, 40],
  flipper: [0, 0.3, 25],
  launch: [0.5, 0.2, 80],
  drain: [0.8, 0.8, 300],
  bonus: [0.4, 1, 250],
  goal: [0.4, 1, 250],
  target: [0.1, 0.4, 30],
  drop: [0.2, 0.4, 40],
  spinner: [0, 0.15, 15],
  saucer: [0.3, 0.3, 60],
  kick: [0.4, 0.2, 60],
  kickback: [0.6, 0.4, 120],
  multiball: [0.6, 1, 400],
};

interface PromptHud {
  text: string; // completed sections only
  started: boolean;
  done: boolean;
  goal: { section: string; masked: string; revealed: number; letters: number } | null;
}

interface Hud {
  prompt: PromptHud;
  score: number;
  balls: number;
  multiplier: number;
  high: number;
  gamepad: string | null;
  goals: Goal[];
  soundReady: boolean;
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

function loadMuted(): boolean {
  try {
    return localStorage.getItem("pinball-muted") === "1";
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean) {
  try {
    localStorage.setItem("pinball-muted", muted ? "1" : "0");
  } catch {}
}

export default function Pinball() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<Sound | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hud, setHud] = useState<Hud>({
    prompt: { text: "", started: false, done: false, goal: null },
    score: 0,
    balls: 3,
    multiplier: 1,
    high: 0,
    gamepad: null,
    goals: [],
    soundReady: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const table = buildTable();
    const game = createGame(table.features);
    const input = new Input();
    input.attach();
    let high = loadHigh();

    const sound = new Sound();
    sound.muted = loadMuted();
    setMuted(sound.muted);
    soundRef.current = sound;
    // Browsers only start audio after the player interacts with the page.
    const unlock = () => sound.unlock();
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerdown", unlock);

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
      if (snap.start) sound.unlock();
      // Brief lockout after game over so a last-second flip doesn't instantly restart.
      const canStart = game.phase === "ready" || now - gameOverAt > 1500;
      if (snap.start && game.phase !== "playing" && canStart) startGame(game);

      while (acc >= STEP) {
        stepGame(game, snap, STEP);
        acc -= STEP;
      }

      for (const e of game.events) {
        sound.play(e);
        const r = RUMBLE[e];
        if (r) input.rumble(...r);
      }
      game.events.length = 0;

      if (game.score > high) high = game.score;
      if (game.phase === "gameover" && prevPhase === "playing") {
        saveHigh(high);
        gameOverAt = now;
      }
      prevPhase = game.phase;

      render(ctx, game, now / 1000);

      const goal = game.prompt.goal;
      const next: Hud = {
        prompt: {
          text: promptText(game.prompt),
          started: game.prompt.started,
          done: game.prompt.state.done,
          goal: goal && { section: goal.section, masked: maskedGoal(goal), revealed: goal.revealed, letters: goal.letters },
        },
        score: game.score,
        balls: game.ballsLeft,
        multiplier: game.multiplier,
        high,
        gamepad: snap.gamepad,
        goals: table.goals(game),
        soundReady: sound.ready,
      };
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
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerdown", unlock);
      input.detach();
    };
  }, []);

  // Keep the newest part of the prompt in view as it grows.
  useEffect(() => {
    const el = promptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hud.prompt.text]);

  const toggleSound = () => {
    const sound = soundRef.current;
    if (!sound) return;
    sound.muted = !sound.muted;
    sound.unlock();
    saveMuted(sound.muted);
    setMuted(sound.muted);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(hud.prompt.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const { prompt } = hud;

  return (
    <div className="wrap">
      <canvas ref={canvasRef} />
      <div className="hud">
        <h1>WIREFRAME PINBALL</h1>
        <div className="dim">SCORE</div>
        <div className="big">{hud.score.toLocaleString()}</div>
        <div className="row">
          <div>
            <div className="dim">BALLS LEFT</div>
            <div>{"● ".repeat(Math.max(0, hud.balls)) || "-"}</div>
          </div>
          <div>
            <div className="dim">BONUS</div>
            <div>{hud.multiplier}X</div>
          </div>
          <div>
            <div className="dim">HIGH</div>
            <div>{hud.high.toLocaleString()}</div>
          </div>
        </div>

        <div className="dim section">YOUR PROMPT</div>
        <div ref={promptRef} className={`prompt${prompt.done ? " done" : ""}`}>
          {prompt.text || <span className="dim">Launch the ball to start your prompt.</span>}
        </div>
        {prompt.goal && (
          <div className="prompt-goal">
            <div className="dim">
              NEXT SECTION: {prompt.goal.section.toUpperCase()} · {prompt.goal.revealed}/{prompt.goal.letters}
            </div>
            <div>
              {prompt.goal.masked.split(/(▒+)/).map((part, i) =>
                part.startsWith("▒") ? (
                  <span key={i} className="hidden">
                    {part}
                  </span>
                ) : (
                  part
                ),
              )}
            </div>
            <div className="tip">Every score reveals a couple of letters. Finish the section to add it to your prompt.</div>
          </div>
        )}
        {prompt.done && (
          <button className="sound" onClick={copyPrompt} disabled={!prompt.text}>
            {copied ? "COPIED" : "COPY PROMPT"}
          </button>
        )}

        <div className="dim section">WHAT TO AIM FOR</div>
        <ul className="goals">
          {hud.goals.map((goal) => (
            <li key={goal.text} className={goal.ready ? "ready" : undefined} style={{ color: goal.color }}>
              <span className="dot" style={{ background: goal.color }} />
              <div>
                <div>{goal.text}</div>
                <div className="status">{goal.status}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="dim section">CONTROLS</div>
        <table className="dim">
          <tbody>
            <tr><td>Left flipper</td><td>LT (Z)</td></tr>
            <tr><td>Right flipper</td><td>RT (M)</td></tr>
            <tr><td>Launch ball</td><td>hold both, let go</td></tr>
            <tr><td>Start</td><td>either trigger</td></tr>
          </tbody>
        </table>
        <div className="tip">
          Tip: tapping a flipper also moves which yellow lanes are lit, so you can line up the unlit one.
        </div>

        <div className="dim section">CONTROLLER</div>
        <div style={{ fontSize: 12 }}>{hud.gamepad ?? "none (press a button to connect)"}</div>

        <button className="sound" onClick={toggleSound}>
          SOUND: {muted ? "OFF" : "ON"}
        </button>
        {!muted && !hud.soundReady && <div className="tip">Click or press any key to turn the sound on.</div>}
      </div>
    </div>
  );
}
