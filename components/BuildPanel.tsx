"use client";

// "Build it with Claude": sends the finished prompt to /api/build, which runs Claude Code on this
// computer, and shows its progress live. See lib/build/claude.ts. While it runs, the table switches
// to pachinko (lib/pachinko); any add-ons won there are added by a second pass once the build is done.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BuildEvent } from "@/lib/build/claude";
import { addonById, bucketColor } from "@/lib/pachinko/addons";

type Phase = "idle" | "running" | "done" | "error";
/** What's running: the build itself, then (if any were won) the add-on pass. */
export type BuildStage = "main" | "addons";
type Share = { status: "sharing" } | { status: "shared"; id: string } | { status: "error"; message: string };
type Done = Extract<BuildEvent, { type: "done" }>;

interface Result {
  id: string;
  dir: string;
  summary: string;
  files: string[];
}

const MAX_LOG = 5;

async function errorFrom(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {}
  return `The server said ${res.status} ${res.statusText}.`;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Streams one /api/build request into `handle`. Resolves with its "done" event, if there was one. */
async function stream(body: object, signal: AbortSignal, handle: (e: BuildEvent) => void): Promise<Done | null> {
  let finished = false;
  let done: Done | null = null;
  try {
    const res = await fetch("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      handle({ type: "error", message: await errorFrom(res) });
      return null;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done: eof } = await reader.read();
      if (eof) break;
      buf += decoder.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let event: BuildEvent;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === "done" || event.type === "error") finished = true;
        if (event.type === "done") done = event;
        handle(event);
      }
    }
    if (!finished) handle({ type: "error", message: "Lost the connection to the build." });
  } catch (e) {
    if (finished) return done;
    const aborted = (e as Error).name === "AbortError";
    handle({
      type: "error",
      message: aborted ? "Build cancelled." : "Couldn't reach the game's server. Is `npm run dev` still running?",
    });
  }
  return done;
}

interface Props {
  prompt: string;
  ready: boolean;
  /** The last game saved to the leaderboard: a build of its prompt can be shared under it. */
  savedRun: { id: string; prompt: string } | null;
  /** Add-on ids won in the pachinko so far; read when the main build finishes. */
  addons: string[];
  /** Called with the running stage, or null when nothing is running. */
  onStage: (stage: BuildStage | null) => void;
}

export default function BuildPanel({ prompt, ready, savedRun, addons, onStage }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<BuildStage>("main");
  const [log, setLog] = useState<string[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [dir, setDir] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [builtPrompt, setBuiltPrompt] = useState<string | null>(null);
  const [addedAddons, setAddedAddons] = useState<string[]>([]);
  const [scoreId, setScoreId] = useState<string | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const addonsRef = useRef(addons);
  addonsRef.current = addons;
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  useEffect(() => {
    onStageRef.current(phase === "running" ? stage : null);
  }, [phase, stage]);

  // Link the build to its leaderboard run. The score may finish saving after the build starts,
  // and a later game's score must not be picked up, so match on the prompt.
  useEffect(() => {
    if (savedRun && savedRun.prompt === builtPrompt) setScoreId(savedRun.id);
  }, [savedRun, builtPrompt]);

  // Stop the build if the game page goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (phase !== "running") return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Done and error events are left to `build`, which knows whether an add-on pass follows.
  const handle = (addonPass: boolean) => (e: BuildEvent) => {
    switch (e.type) {
      case "start":
        setDir(e.dir);
        break;
      case "status":
        setLog((l) => [...l, e.text].slice(-MAX_LOG));
        break;
      case "file":
        setFiles((f) => (f.includes(e.path) ? f : [...f, e.path]));
        break;
      case "done":
        setResult({ id: e.id, dir: e.dir, summary: e.summary, files: e.files });
        break;
      case "error":
        // A failed add-on pass still leaves the main build, so that's shown with the error.
        setError(addonPass ? `The add-ons weren't added: ${e.message}` : e.message);
        setPhase(addonPass ? "done" : "error");
        break;
    }
  };

  const build = async () => {
    if (phase === "running" || !prompt.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStage("main");
    setPhase("running");
    setLog([]);
    setFiles([]);
    setDir(null);
    setResult(null);
    setError(null);
    setBuiltPrompt(prompt);
    setAddedAddons([]);
    setScoreId(null);
    setShare(null);

    try {
      const built = await stream({ prompt }, controller.signal, handle(false));
      if (!built) return;
      const won = addonsRef.current;
      if (won.length > 0) {
        // Lock in what was won in the pachinko and have Claude add it to the build.
        setStage("addons");
        setAddedAddons(won);
        setLog([]);
        if (!(await stream({ prompt, buildId: built.id, addons: won }, controller.signal, handle(true)))) return;
      }
      setPhase("done");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  const shareBuild = async () => {
    if (!result || !scoreId) return;
    setShare({ status: "sharing" });
    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildId: result.id, scoreId, summary: result.summary }),
      });
      if (!res.ok) return setShare({ status: "error", message: await errorFrom(res) });
      const { id } = await res.json();
      setShare({ status: "shared", id });
    } catch {
      setShare({ status: "error", message: "Couldn't reach the game's server. Is `npm run dev` still running?" });
    }
  };

  const open = async (target: "page" | "folder") => {
    if (!result) return;
    try {
      const res = await fetch("/api/build/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: result.id, target }),
      });
      if (!res.ok) setError(await errorFrom(res));
    } catch {
      setError("Couldn't reach the game's server. Is `npm run dev` still running?");
    }
  };

  // During the next game, keep showing a finished or running build; drop a failed one.
  if (!ready && (phase === "idle" || phase === "error")) return null;

  const canBuild = ready && phase !== "running" && !!prompt.trim();
  const hasPage = result?.files.includes("index.html") ?? false;
  const shareable = hasPage && result?.files.length === 1;

  return (
    <div className={`build build--${phase}`}>
      {phase === "running" && (
        <>
          <div className="build-head">
            <span className="chip teal-chip">{stage === "main" ? "CLAUDE IS BUILDING" : "ADDING ADD-ONS"}</span>
            <span className="muted">{formatTime(elapsed)}</span>
          </div>
          <div className="build-spinner" aria-hidden />
          <div className="pachinko-note">
            {stage === "main" ? (
              <>
                <strong>Pinball is paused: you&apos;re playing pachinko!</strong> Drop balls with either trigger.
                Each bucket is an add-on for Claude to build in once the main build is done.
              </>
            ) : (
              <strong>Add-ons locked in. Claude is adding them now.</strong>
            )}
            <AddonList ids={stage === "main" ? addons : addedAddons} />
          </div>
          {log.length > 0 ? (
            <ul className="build-log">
              {log.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="muted small">Starting Claude Code…</div>
          )}
          {files.length > 0 && <FileList files={files} />}
          {dir && <div className="muted small build-path">{dir}</div>}
          <button className="build-secondary" onClick={cancel}>
            CANCEL
          </button>
        </>
      )}

      {phase === "done" && result && (
        <>
          <div className="build-head">
            <span className="chip mint">{ready ? "BUILT" : "LAST BUILD"}</span>
          </div>
          {!ready && builtPrompt && (
            <div className="muted small build-prompt" title={builtPrompt}>
              {builtPrompt}
            </div>
          )}
          <div className="build-summary">{result.summary}</div>
          <AddonList ids={addedAddons} />
          <FileList files={result.files} />
          <div className="build-actions">
            {hasPage && (
              <button className="build-primary" onClick={() => open("page")}>
                OPEN IT
              </button>
            )}
            <button className="build-secondary" onClick={() => open("folder")}>
              SHOW FOLDER
            </button>
            {shareable && scoreId && share?.status !== "shared" && (
              <button className="build-secondary" onClick={shareBuild} disabled={share?.status === "sharing"}>
                {share?.status === "sharing" ? "SHARING…" : "SHARE"}
              </button>
            )}
          </div>
          {share?.status === "shared" && (
            <div className="small build-shared">
              Shared! <Link href={`/apps/${share.id}`}>See it in Apps</Link>
            </div>
          )}
          {share?.status === "error" && <div className="build-fail small">{share.message}</div>}
          {hasPage && !shareable && (
            <div className="muted small">Only single-file builds can be shared, and this one has extra files.</div>
          )}
          {shareable && !scoreId && (
            <div className="muted small">Save this game to the leaderboard to share the app.</div>
          )}
          <div className="muted small build-path">{result.dir}</div>
          {error && <div className="build-fail small">{error}</div>}
        </>
      )}

      {phase === "error" && (
        <>
          <div className="build-head">
            <span className="chip pink-chip">BUILD STOPPED</span>
          </div>
          <div className="build-fail">{error}</div>
          {dir && <div className="muted small build-path">{dir}</div>}
        </>
      )}

      {canBuild && (
        <>
          <button className="build-primary build-go" onClick={build}>
            {phase === "idle" ? "BUILD IT WITH CLAUDE" : builtPrompt === prompt ? "BUILD IT AGAIN" : "BUILD THIS ONE"}
          </button>
          {phase === "idle" && (
            <div className="muted small">
              Claude Code builds your prompt as a web page in a new folder on this computer. It can only
              write files inside that folder. While it works, the table turns into pachinko: win add-ons
              for your build.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddonList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="build-files">
      {ids.map((id, i) => {
        const a = addonById(id);
        return (
          <span key={id} className="chip addon-chip" style={{ background: bucketColor(i) }}>
            + {a ? a.label.replace("\n", " ") : id}
          </span>
        );
      })}
    </div>
  );
}

function FileList({ files }: { files: string[] }) {
  return (
    <div className="build-files">
      {files.map((f) => (
        <span key={f} className="chip">
          {f}
        </span>
      ))}
    </div>
  );
}
