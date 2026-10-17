"use client";

// A shared app in its sandboxed iframe, with full screen (F key or button) and open-in-new-tab.
// In full screen the Escape key is locked, so Chrome/Edge only leave full screen when Esc is held
// down: a quick tap meant for the app doesn't throw you out. Other browsers exit on a single Esc.

import { useEffect, useRef, useState } from "react";

// Keyboard Lock API (Chromium only), not in TypeScript's DOM types yet.
type KeyboardLock = { lock(keys?: string[]): Promise<void>; unlock(): void };
const keyboardLock = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

const typing = (el: Element | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export default function AppFrame({ id, title }: { id: string; title: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [full, setFull] = useState(false);
  const [holdToExit, setHoldToExit] = useState(false);
  const src = `/apps/${id}/raw`;

  useEffect(() => setHoldToExit(!!keyboardLock()?.lock), []);

  const enter = async () => {
    const wrap = wrapRef.current;
    if (!wrap || document.fullscreenElement) return;
    try {
      await wrap.requestFullscreen();
      await keyboardLock()?.lock(["Escape"]).catch(() => {});
    } catch {}
    frameRef.current?.focus(); // so the app gets the keyboard straight away
  };

  useEffect(() => {
    const onChange = () => {
      const isFull = document.fullscreenElement === wrapRef.current;
      setFull(isFull);
      if (!isFull) keyboardLock()?.unlock();
    };
    // Only reaches us while the page itself has focus: keys typed into the app stay in the app.
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyF" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement)) return;
      e.preventDefault();
      enter();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
      keyboardLock()?.unlock();
    };
  }, []);

  return (
    <>
      <div className="app-frame-bar">
        <span className="dim small">
          Press <kbd>F</kbd> for full screen · {holdToExit ? "hold" : "press"} <kbd>Esc</kbd> to leave it
        </span>
        <div className="app-frame-actions">
          <button onClick={enter}>FULL SCREEN</button>
          <a className="app-frame-tab" href={src} target="_blank" rel="noopener noreferrer">
            OPEN IN NEW TAB ↗
          </a>
        </div>
      </div>
      <div ref={wrapRef} className={`app-frame-wrap${full ? " full" : ""}`}>
        {/* The page itself also sends a CSP sandbox header; this attribute is a second lock. */}
        <iframe
          ref={frameRef}
          className="app-frame"
          src={src}
          sandbox="allow-scripts allow-pointer-lock"
          referrerPolicy="no-referrer"
          title={title}
        />
      </div>
    </>
  );
}
