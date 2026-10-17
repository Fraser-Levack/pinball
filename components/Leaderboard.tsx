"use client";

import { useEffect, useState } from "react";

interface Entry {
  id: string;
  player_name: string;
  score: number;
  sections: number;
  prompt: string;
  created_at: string;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/scores")
      .then(res => {
        if (!res.ok) throw new Error("load failed");
        return res.json();
      })
      .then(setEntries)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="dim">Could not load the leaderboard.</p>;
  if (!entries) return <p className="dim">Loading…</p>;
  if (entries.length === 0) return <p className="dim">No scores yet. Finish a game and post your prompt.</p>;

  return (
    <ol className="board">
      {entries.map((e, i) => (
        <li key={e.id}>
          <div className="board-row">
            <span className="rank">{i + 1}</span>
            <span className="board-name">{e.player_name}</span>
            <span className="board-score">{e.score.toLocaleString()}</span>
          </div>
          <details>
            <summary className="dim small">
              {e.sections} {e.sections === 1 ? "section" : "sections"} · {new Date(e.created_at).toLocaleString()}
            </summary>
            <pre className="board-prompt">{e.prompt}</pre>
          </details>
        </li>
      ))}
    </ol>
  );
}
