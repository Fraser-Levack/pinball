import Link from "next/link";
import LikeButton from "@/components/LikeButton";
import { APP_SORTS, type AppSort, type SharedApp, appTitle, listApps } from "@/lib/builds";

const SORT_LABELS: Record<AppSort, string> = { popular: "POPULAR", new: "NEW" };

export default async function AppsPage(props: PageProps<"/apps">) {
  const { sort: param } = await props.searchParams;
  const sort: AppSort = param === "new" ? "new" : "popular";

  let apps: Awaited<ReturnType<typeof listApps>> | null = null;
  try {
    apps = await listApps(sort);
  } catch (e) {
    console.error(e); // server-side: shows in the `npm run dev` terminal, not the browser
  }

  return (
    <div className="builder">
      <div className="apps-head">
        <h1>APPS</h1>
        <Link href="/apps/add" className="dim small">+ ADD AN APP</Link>
      </div>
      <nav className="apps-sort" aria-label="Sort apps">
        {APP_SORTS.map(s => (
          <Link
            key={s}
            href={s === "popular" ? "/apps" : `/apps?sort=${s}`}
            className={s === sort ? "active" : undefined}
            aria-current={s === sort ? "page" : undefined}
          >
            {SORT_LABELS[s]}
          </Link>
        ))}
      </nav>
      {!apps ? (
        <p className="dim">Could not load apps.</p>
      ) : apps.featured.length + apps.recent.length === 0 ? (
        <p className="dim">No apps yet. Finish a game, build your prompt with Claude and share it.</p>
      ) : (
        <>
          {apps.featured.length > 0 && <AppGrid title="FEATURED" apps={apps.featured} />}
          {apps.recent.length > 0 && <AppGrid title={sort === "popular" ? "MOST LIKED" : "NEWEST"} apps={apps.recent} />}
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
          // The title link stretches over the whole card, so the like button can sit on it without being inside a link.
          <div key={app.id} className={`app-card${app.featured ? " featured" : ""}`}>
            <Link href={`/apps/${app.id}`} className="app-title app-card-link">{appTitle(app)}</Link>
            <div className="app-blurb" title={app.summary}>{app.summary}</div>
            <div className="app-meta">
              <span>{app.scores.player_name}</span>
              <span>{app.scores.score.toLocaleString()} pts</span>
              <LikeButton id={app.id} likes={app.like_count} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
