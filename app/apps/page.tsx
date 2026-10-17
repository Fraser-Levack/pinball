import Link from "next/link";
import { type SharedApp, appTitle, listApps } from "@/lib/builds";

export default async function AppsPage() {
  let apps: Awaited<ReturnType<typeof listApps>> | null = null;
  try {
    apps = await listApps();
  } catch (e) {
    console.error(e); // server-side: shows in the `npm run dev` terminal, not the browser
  }

  return (
    <div className="builder">
      <div className="apps-head">
        <h1>APPS</h1>
        <Link href="/apps/add" className="dim small">+ ADD AN APP</Link>
      </div>
      {!apps ? (
        <p className="dim">Could not load apps.</p>
      ) : apps.featured.length + apps.recent.length === 0 ? (
        <p className="dim">No apps yet. Finish a game, build your prompt with Claude and share it.</p>
      ) : (
        <>
          {apps.featured.length > 0 && <AppGrid title="FEATURED" apps={apps.featured} />}
          {apps.recent.length > 0 && <AppGrid title="RECENT" apps={apps.recent} />}
        </>
      )}
    </div>
  );
}

function AppGrid({ title, apps }: { title: string; apps: SharedApp[] }) {
  return (
    <section className="apps-section">
      <h2>{title}</h2>
      <div className="apps-grid">
        {apps.map(app => (
          <Link key={app.id} href={`/apps/${app.id}`} className={`app-card${app.featured ? " featured" : ""}`}>
            <div className="app-title">{appTitle(app)}</div>
            <div className="app-blurb" title={app.summary}>{app.summary}</div>
            <div className="app-meta">
              <span>{app.scores.player_name}</span>
              <span>{app.scores.score.toLocaleString()} pts</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
