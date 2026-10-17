"use client";

import { useState } from "react";

// Floats above the table until a name is entered. The ball can't launch before then.
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
    </form>
  );
}
