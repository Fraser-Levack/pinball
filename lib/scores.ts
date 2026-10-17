// Client-side helpers for saving finished games to the leaderboard.

export interface Run {
  score: number;
  sections: number;
  prompt: string;
}

export interface SaveState {
  status: "saving" | "saved" | "error";
  run: Run;
}

export async function saveRun(name: string, run: Run): Promise<boolean> {
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ...run }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
