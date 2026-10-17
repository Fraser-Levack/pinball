// Client-side helpers for saving finished games to the leaderboard.

export interface Run {
  score: number;
  sections: number;
  prompt: string;
}

export interface SaveState {
  status: "saving" | "saved" | "error";
  run: Run;
  id?: string; // the leaderboard row, once saved
}

/** Saves the run and returns its leaderboard row id, or null if it couldn't be saved. */
export async function saveRun(name: string, run: Run): Promise<string | null> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...run }),
    });
    if (!res.ok) return null;
    const row = await res.json();
    return typeof row?.id === "string" ? row.id : null;
  } catch {
    return null;
  }
}
