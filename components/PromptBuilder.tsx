"use client";

import { useState } from "react";
import { dictionary } from "@/lib/prompt/dictionary";
import { advance, canAdvance, finish, initialState, render, upcoming } from "@/lib/prompt/engine";

export default function PromptBuilder() {
  const [state, setState] = useState(initialState);
  const [copied, setCopied] = useState(false);

  const prompt = render(state.segments);
  const next = upcoming(dictionary, state);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className="builder">
      <h1>PROMPT BUILDER</h1>

      <div className="controls">
        <button onClick={() => setState(s => advance(dictionary, s))} disabled={!canAdvance(dictionary, state)}>
          Add next
        </button>
        <button onClick={() => setState(s => finish(dictionary, s))} disabled={state.done}>
          Finish
        </button>
        <button onClick={() => setState(initialState())}>Reset</button>
        <button onClick={copy} disabled={!prompt}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="dim">
        {state.done ? "Finished." : `Next: ${next ?? "nothing"}`}
        {state.iteration > 0 && ` · loop passes: ${state.iteration}`}
      </p>

      <div className="output">{prompt || <span className="dim">Click “Add next” to start.</span>}</div>

      <table>
        <tbody>
          {state.segments.map((seg, i) => (
            <tr key={i}>
              <td className="dim">{i + 1}</td>
              <td className="dim">
                {seg.section}
                {seg.iteration !== undefined && ` #${seg.iteration + 1}`}
              </td>
              <td>{seg.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
