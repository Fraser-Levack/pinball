"use client";

// The ♥ on a shared app. There are no accounts: each browser makes itself a random id, and the
// server (app/api/likes) keeps one like per id per app.

import { useEffect, useState } from "react";

const LIKER_KEY = "pinball-liker";

function likerId(): string | null {
  try {
    let id = localStorage.getItem(LIKER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(LIKER_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// The apps this browser has liked: fetched once per page load and shared by every button, which
// keep it up to date as they're clicked.
let likedApps: Promise<Set<string>> | null = null;

function loadLiked(liker: string): Promise<Set<string>> {
  likedApps ??= fetch(`/api/likes?liker=${liker}`)
    .then((res) => (res.ok ? res.json() : []))
    .then((ids: string[]) => new Set(ids))
    .catch(() => new Set<string>());
  return likedApps;
}

export default function LikeButton({ id, likes }: { id: string; likes: number }) {
  const [count, setCount] = useState(likes);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setCount(likes), [likes]);

  useEffect(() => {
    const liker = likerId();
    if (!liker) return;
    let live = true;
    loadLiked(liker).then((set) => live && setLiked(set.has(id)));
    return () => {
      live = false;
    };
  }, [id]);

  const toggle = async () => {
    const liker = likerId();
    if (!liker || busy) return;
    const next = !liked;
    // Show it straight away; put it back if the server says no.
    setBusy(true);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, liker, liked: next }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setCount(body.likes);
      const set = await loadLiked(liker);
      if (next) set.add(id);
      else set.delete(id);
    } catch {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className={`like${liked ? " liked" : ""}`}
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this app" : "Like this app"}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span> {count}
    </button>
  );
}
