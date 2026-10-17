import Link from "next/link";
import type { SaveState } from "@/lib/scores";

interface Props extends SaveState {
  onRetry: () => void;
}

export default function ScoreStatus({ status, run, onRetry }: Props) {
  return (
    <section className="card score-status">
      <div className="card-head">
        <span>SCORE</span>
        <span className="chip">{run.score.toLocaleString()}</span>
      </div>
      {status === "saving" && <div className="muted">Saving to the leaderboard…</div>}
      {status === "saved" && (
        <div className="muted">
          Saved. <Link href="/leaderboard">View the leaderboard</Link>
        </div>
      )}
      {status === "error" && (
        <div className="error">
          Couldn&apos;t save this game.{" "}
          <button className="retry" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </section>
  );
}
