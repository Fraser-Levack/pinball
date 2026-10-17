"use client";

// Form for adding an app by hand: its index.html and the prompt it was built from.
// See app/api/builds/manual.

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useState } from "react";

async function errorFrom(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === "string") return body.error;
  } catch {}
  return `The server said ${res.status} ${res.statusText}.`;
}

type Status = { state: "idle" } | { state: "saving" } | { state: "done"; id: string; linked: boolean } | { state: "error"; message: string };

// Loads a picked file's text into a field.
const readInto = (set: (text: string) => void) => async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) set(await file.text());
};

export default function AddAppForm() {
  const [html, setHtml] = useState("");
  const [prompt, setPrompt] = useState("");
  const [summary, setSummary] = useState("");
  const [name, setName] = useState("");
  const [score, setScore] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus({ state: "saving" });
    try {
      const res = await fetch("/api/builds/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, prompt, summary, name, score: score ? Number(score) : 0 }),
      });
      if (!res.ok) return setStatus({ state: "error", message: await errorFrom(res) });
      const { id, linked } = await res.json();
      setStatus({ state: "done", id, linked });
    } catch {
      setStatus({ state: "error", message: "Couldn't reach the game's server. Is `npm run dev` still running?" });
    }
  };

  const reset = () => {
    setHtml("");
    setPrompt("");
    setSummary("");
    setStatus({ state: "idle" });
  };

  if (status.state === "done") {
    return (
      <div className="add-app">
        <p>
          Added!{" "}
          {status.linked ? "It was linked to the leaderboard run with the same prompt." : "A leaderboard run was created for it."}
        </p>
        <div className="controls">
          <Link href={`/apps/${status.id}`} className="add-app-link">
            SEE IT
          </Link>
          <button onClick={reset}>ADD ANOTHER</button>
        </div>
      </div>
    );
  }

  return (
    <form className="add-app" onSubmit={submit}>
      <label>
        <span>index.html</span>
        <input type="file" accept=".html,.htm,text/html" onChange={readInto(setHtml)} />
        <textarea value={html} onChange={e => setHtml(e.target.value)} rows={6} placeholder="…or paste the HTML here" spellCheck={false} required />
      </label>

      <label>
        <span>Prompt it was built from</span>
        <input type="file" accept=".txt,text/plain" onChange={readInto(t => setPrompt(t.trim()))} />
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="…or paste the prompt here" required />
      </label>

      <label>
        <span>Description</span>
        <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} maxLength={600} placeholder="One or two sentences on what it is" required />
      </label>

      <fieldset>
        <legend className="dim small">
          If a leaderboard run has exactly this prompt the app is linked to it. Otherwise a run is added with this
          name and score.
        </legend>
        <div className="add-app-row">
          <label>
            <span>Player name</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={16} />
          </label>
          <label>
            <span>Score</span>
            <input type="number" min={0} step={1} value={score} onChange={e => setScore(e.target.value)} placeholder="0" />
          </label>
        </div>
      </fieldset>

      <div className="controls">
        <button type="submit" disabled={status.state === "saving" || !html.trim() || !prompt.trim() || !summary.trim()}>
          {status.state === "saving" ? "ADDING…" : "ADD APP"}
        </button>
      </div>
      {status.state === "error" && <p className="add-app-error">{status.message}</p>}
    </form>
  );
}
