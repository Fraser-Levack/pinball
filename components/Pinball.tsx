"use client";

import { useEffect, useRef, useState } from "react";
import NameCard from "@/components/NameCard";
import ScoreStatus from "@/components/ScoreStatus";
import { usePlayer } from "@/components/PlayerProvider";
import BuildPanel from "@/components/BuildPanel";
import { H, W, createGame, startGame, stepGame } from "@/lib/game";
import { Input } from "@/lib/input";
import { maskedGoal, promptText } from "@/lib/prompt/run";
import { render } from "@/lib/render";
import { type Run, type SaveState, saveRun } from "@/lib/scores";
import { Sound } from "@/lib/sound";
import { buildTable } from "@/lib/table";

const STEP = 1 / 120;
const TAB_BAR = 44; // height of the tab bar in app/layout.tsx

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
  multiball: [0.6, 1, 400],
};

interface PromptHud {
  text: string; // completed sections only
  sections: number;
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
  const { name, setName } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<Sound | null>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [save, setSave] = useState<SaveState | null>(null);
  const publish = (run: Run) => {
    setSave({ status: "saving", run });
    saveRun(name, run).then(ok => setSave({ status: ok ? "saved" : "error", run }));
  };
  // The game loop is set up once per mount, so it reaches the latest values through these refs.
  const publishRef = useRef(publish);
  publishRef.current = publish;
  const nameRef = useRef(name);
  nameRef.current = name;
  const [hud, setHud] = useState<Hud>({
    prompt: { text: "", sections: 0, started: false, done: false, goal: null },
    score: 0,
    balls: 3,
    multiplier: 1,
    high: 0,
    gamepad: null,
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
      const scale = Math.min((window.innerHeight - 32 - TAB_BAR) / H, (window.innerWidth - 32) / W);
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
      // No launching until a player name is entered.
      if (snap.start && nameRef.current && game.phase !== "playing" && canStart) {
        startGame(game);
        setSave(null);
      }

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
        publishRef.current({
          score: game.score,
          sections: game.prompt.state.segments.length,
          prompt: promptText(game.prompt),
        });
      }
      prevPhase = game.phase;

      render(ctx, game, now / 1000);

      const goal = game.prompt.goal;
      const next: Hud = {
        prompt: {
          text: promptText(game.prompt),
          sections: game.prompt.state.segments.length,
          started: game.prompt.started,
          done: game.prompt.state.done,
          goal: goal && { section: goal.section, masked: maskedGoal(goal), revealed: goal.revealed, letters: goal.letters },
        },
        score: game.score,
        balls: game.ballsLeft,
        multiplier: game.multiplier,
        high,
        gamepad: snap.gamepad,
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
  const goal = prompt.goal;

  return (
    <div className="wrap">
      <div className="table-wrap">
        <canvas ref={canvasRef} />
        {!name && <NameCard onSubmit={setName} />}
      </div>
      <aside className="hud">
        <h1>PROMPT PINBALL</h1>
        {name && <div className="muted small">Playing as {name}</div>}

        <section className={`card prompt-card${prompt.done ? " done" : ""}`}>
          <div className="card-head">
            <span>YOUR PROMPT</span>
            <span className="chip">
              {prompt.sections} {prompt.sections === 1 ? "section" : "sections"}
            </span>
          </div>
          <div ref={promptRef} className="prompt-text">
            {prompt.text || <span className="muted">Launch the ball to start your prompt.</span>}
          </div>

          {goal && (
            <div className="goal">
              <div className="goal-head">
                <span className="chip mint">BUILDING · {goal.section.toUpperCase()}</span>
                <span className="muted">
                  {goal.revealed}/{goal.letters} letters
                </span>
              </div>
              <div className="goal-text">
                {[...goal.masked].map((ch, i) =>
                  ch === "▒" ? <span key={i} className="blank" /> : <span key={i}>{ch}</span>,
                )}
              </div>
              <div className="progress">
                <div style={{ width: `${(100 * goal.revealed) / goal.letters}%` }} />
              </div>
              <div className="muted small">Every score reveals letters. Finish the section to add it.</div>
            </div>
          )}

          {prompt.done && (
            <button className="copy" onClick={copyPrompt} disabled={!prompt.text}>
              {copied ? "COPIED!" : "COPY PROMPT"}
            </button>
          )}
          <BuildPanel prompt={prompt.text} ready={prompt.done && !!prompt.text} />
        </section>

        {save && <ScoreStatus {...save} onRetry={() => publish(save.run)} />}

        <section className="tiles">
          <div className="tile yellow">
            <div className="tile-label">SCORE</div>
            <div className="tile-value">{hud.score.toLocaleString()}</div>
          </div>
          <div className="tile teal">
            <div className="tile-label">BONUS</div>
            <div className="tile-value">{hud.multiplier}X</div>
          </div>
          <div className="tile">
            <div className="tile-label">HIGH</div>
            <div className="tile-value">{hud.high.toLocaleString()}</div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span>CONTROLS</span>
          </div>
          <table>
            <tbody>
              <tr><td>Left flipper</td><td>LT (Z)</td></tr>
              <tr><td>Right flipper</td><td>RT (M)</td></tr>
              <tr><td>Launch ball</td><td>hold both, let go</td></tr>
              <tr><td>Start</td><td>either trigger</td></tr>
            </tbody>
          </table>
          <div className="muted small">
            Tapping a flipper moves which yellow lanes are lit, so you can line up the unlit one.
          </div>
          <div className="muted small">Controller: {hud.gamepad ?? "none (press a button to connect)"}</div>
          <button className="sound" onClick={toggleSound}>
            SOUND {muted ? "OFF" : "ON"}
          </button>
          {!muted && !hud.soundReady && <div className="muted small">Click or press any key to turn the sound on.</div>}
        </section>
      </aside>
    </div>
  );
}
