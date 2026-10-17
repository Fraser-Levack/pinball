"use client";

import { useState } from "react";

// Floats above the table until a name is entered (or the player picks anonymous). The ball can't
// launch before then.

export const ANONYMOUS = "Anonymous"; // shown on the leaderboard for anonymous runs
export default function NameCard({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  return (
    <form
      className="name-card"
      onSubmit={e => {
        e.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <label htmlFor="player-name">Enter your name to play</label>
      <div className="submit-row">
        <input
          id="player-name"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={16}
          autoFocus
          required
        />
        <button disabled={!trimmed}>Play</button>
      </div>
      <button type="button" className="anon" onClick={() => onSubmit(ANONYMOUS)}>
        Play anonymously
      </button>
    </form>
  );
}
