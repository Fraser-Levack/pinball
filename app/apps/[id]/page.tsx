import Link from "next/link";
import { notFound } from "next/navigation";
import AppFrame from "@/components/AppFrame";
import LikeButton from "@/components/LikeButton";
import { appTitle, getApp } from "@/lib/builds";

export default async function AppPage(props: PageProps<"/apps/[id]">) {
  const { id } = await props.params;
  const app = await getApp(id).catch(() => null);
  if (!app) notFound();

  return (
    <div className="builder app-view">
      <div className="app-view-head">
        <Link href="/apps" className="dim small">← ALL APPS</Link>
        <div className="app-view-tags">
          {app.featured && <span className="chip mint">FEATURED</span>}
          <LikeButton id={app.id} likes={app.like_count} />
        </div>
      </div>
      <h2 className="app-view-title">{appTitle(app)}</h2>
      <p className="app-summary">{app.summary}</p>
      <div className="dim small">
        Built by {app.scores.player_name} from a {app.scores.score.toLocaleString()} point run
      </div>
      <AppFrame id={app.id} title={appTitle(app)} />
      <details>
        <summary className="dim small">The prompt</summary>
        <pre className="board-prompt">{app.scores.prompt}</pre>
      </details>
    </div>
  );
}
