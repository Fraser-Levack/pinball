"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface Player {
  name: string;
  setName: (name: string) => void;
}

const PlayerContext = createContext<Player | null>(null);

// The name lives in memory only: a hard refresh clears it, client-side navigation keeps it.
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState("");
  return <PlayerContext value={{ name, setName }}>{children}</PlayerContext>;
}

export function usePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used inside PlayerProvider");
  return player;
}
