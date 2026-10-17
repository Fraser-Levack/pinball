// The pachinko buckets: each one is an add-on for the app Claude is building. Balls that land in a
// bucket win its add-on, and when the main build finishes Claude does a second pass to add them.
// Shared by the game (client) and /api/build (server), which only accepts ids from this list, so
// the instructions sent to Claude are always these fixed strings.

import { PALETTE } from "../draw";

export interface Addon {
  id: string;
  label: string; // short, drawn on the bucket
  color: string;
  instruction: string; // what Claude is asked to add
}

// Left to right. The middle buckets are the easiest to land in.
export const ADDONS: Addon[] = [
  { id: "easter-egg", label: "EASTER\nEGG", color: PALETTE.pink, instruction: "a hidden easter egg the player can discover (a secret key combo or click)" },
  { id: "sound", label: "SOUND", color: PALETTE.yellow, instruction: "small synthesised sound effects using the Web Audio API (no audio files)" },
  { id: "animation", label: "ANIM", color: PALETTE.teal, instruction: "lively animations and transitions" },
  { id: "dark-mode", label: "DARK\nMODE", color: PALETTE.mint, instruction: "a dark mode with a toggle button" },
  { id: "confetti", label: "CONFETTI", color: PALETTE.teal, instruction: "a confetti burst when the user does something satisfying" },
  { id: "save", label: "SAVE", color: PALETTE.yellow, instruction: "saving the user's progress or settings in localStorage" },
  { id: "keyboard", label: "KEYS", color: PALETTE.pink, instruction: "keyboard shortcuts, with a small on-screen hint listing them" },
];

export const MAX_ADDONS = 3; // keeps the add-on pass short

const BY_ID = new Map(ADDONS.map((a) => [a.id, a]));
export const addonById = (id: string) => BY_ID.get(id);
