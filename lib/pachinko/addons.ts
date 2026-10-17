// The pachinko buckets: each one is an add-on for the app Claude is building. Balls that land in a
// bucket win its add-on, and when the main build finishes Claude does a second pass to add them.
// The pool lives in dictonary/Addons.json; each pachinko game fills its buckets with a random pick.
// Shared by the game (client) and /api/build (server), which only accepts ids from the pool, so
// the instructions sent to Claude are always these fixed strings.

import data from "@/dictonary/Addons.json";
import { PALETTE } from "../draw";

export interface Addon {
  id: string;
  label: string; // short, drawn on the bucket; `\n` splits it over two lines
  instruction: string; // what Claude is asked to add
}

export const ADDONS: Addon[] = data.addons;
export const BUCKETS = Math.min(data.buckets, ADDONS.length);
export const MAX_ADDONS = 3; // keeps the add-on pass short

// Bucket colours, left to right.
const COLORS = [PALETTE.pink, PALETTE.yellow, PALETTE.teal, PALETTE.mint];
export const bucketColor = (i: number) => COLORS[i % COLORS.length];

/** A random set of BUCKETS different add-ons, in random order. */
export function pickAddons(rng: () => number = Math.random): Addon[] {
  const pool = [...ADDONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, BUCKETS);
}

const BY_ID = new Map(ADDONS.map((a) => [a.id, a]));
export const addonById = (id: string) => BY_ID.get(id);
