// Prompt randomiser: fills {slot} templates and walks the flow defined in dictonary/prompt.json.

export type Rng = () => number;

export interface Section {
  templates: string[];
  slots?: Record<string, string[]>;
}

export type Step = string | { section: string; chance?: number; joiner?: boolean };
export type FlowItem = Step | { loop: Step[] };

export interface FlowConfig {
  flow: FlowItem[];
  finish: string;
  // slot name -> section whose templates act as a shared word list, e.g. adjective -> Adjectives
  globals?: Record<string, string>;
}

export interface Dictionary {
  sections: Record<string, Section>;
  generators: Record<string, (rng: Rng) => string>;
  config: FlowConfig;
}

export interface Segment {
  section: string;
  text: string;
  joiner: boolean;
  iteration?: number;
}

export interface State {
  item: number; // index into config.flow
  loopStep: number; // index into the loop's steps when item is a loop
  iteration: number; // completed loop passes
  segments: Segment[];
  done: boolean;
}

interface Ctx {
  local: Record<string, string[]>;
  global: Record<string, string[]>;
  generators: Dictionary["generators"];
  rng: Rng;
}

const SLOT = /\{(@?[\w-]+)\}/g;
const MAX_DEPTH = 10;

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

const isLoop = (item: FlowItem): item is { loop: Step[] } => typeof item === "object" && "loop" in item;

const normalise = (step: Step) => (typeof step === "string" ? { section: step } : step);

function lookup(key: string, ctx: Ctx): string[] {
  const local = ctx.local[key];
  return local?.length ? local : ctx.global[key] ?? [];
}

// True when every slot in tpl can eventually produce text (no empty lists, no unknown generators).
function resolvable(tpl: string, ctx: Ctx, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false;
  for (const [, key] of tpl.matchAll(SLOT)) {
    if (key.startsWith("@")) {
      if (!ctx.generators[key.slice(1)]) return false;
    } else if (!lookup(key, ctx).some(opt => resolvable(opt, ctx, depth + 1))) {
      return false;
    }
  }
  return true;
}

function fill(tpl: string, ctx: Ctx, depth = 0): string {
  if (depth > MAX_DEPTH) throw new Error(`Slot nesting too deep in "${tpl}"`);
  return tpl.replace(SLOT, (_, key: string) => {
    if (key.startsWith("@")) {
      const value = ctx.generators[key.slice(1)](ctx.rng);
      if (typeof value !== "string") throw new Error(`Generator {${key}} returned ${value}`);
      return value;
    }
    const options = lookup(key, ctx).filter(opt => resolvable(opt, ctx, depth + 1));
    return fill(pick(options, ctx.rng), ctx, depth + 1);
  });
}

// "a apple" -> "an apple". Naive vowel check, good enough for random prompts.
const fixArticles = (text: string) => text.replace(/\b([Aa]) (?=[aeiouAEIOU])/g, "$1n ");

function globalSlots(dict: Dictionary): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [slot, name] of Object.entries(dict.config.globals ?? {})) {
    out[slot] = dict.sections[name]?.templates ?? [];
  }
  return out;
}

// Produces one random line from a section, or null if nothing in it can be filled yet.
export function generate(dict: Dictionary, name: string, rng: Rng = Math.random): string | null {
  const section = dict.sections[name];
  if (!section) throw new Error(`Unknown section "${name}"`);
  const ctx: Ctx = { local: section.slots ?? {}, global: globalSlots(dict), generators: dict.generators, rng };
  const usable = section.templates.filter(t => resolvable(t, ctx));
  return usable.length ? fixArticles(fill(pick(usable, rng), ctx)) : null;
}

export const initialState = (): State => ({ item: 0, loopStep: 0, iteration: 0, segments: [], done: false });

// The step the cursor is on, plus the cursor position after taking it.
function current(dict: Dictionary, s: State) {
  const item = dict.config.flow[s.item];
  if (!item) return null;
  if (!isLoop(item)) return { step: normalise(item), inLoop: false, after: { ...s, item: s.item + 1 } };
  const steps = item.loop;
  const wraps = s.loopStep + 1 >= steps.length;
  return {
    step: normalise(steps[s.loopStep]),
    inLoop: true,
    after: { ...s, loopStep: wraps ? 0 : s.loopStep + 1, iteration: s.iteration + (wraps ? 1 : 0) },
  };
}

export function canAdvance(dict: Dictionary, s: State): boolean {
  return !s.done && current(dict, s) !== null;
}

export function upcoming(dict: Dictionary, s: State): string | null {
  if (s.done) return null;
  const cur = current(dict, s);
  if (!cur) return null;
  const { section, chance } = cur.step;
  return chance !== undefined && chance < 1 ? `${section} (${Math.round(chance * 100)}% chance)` : section;
}

// Adds the next section. Steps that fail their chance roll, or whose section is still empty,
// are skipped so that each call adds exactly one segment when possible.
export function advance(dict: Dictionary, s: State, rng: Rng = Math.random): State {
  let state = s;
  // Bounded so a loop made only of skippable steps can't spin forever.
  for (let guard = 0; guard < 100 && canAdvance(dict, state); guard++) {
    const cur = current(dict, state)!;
    const { section, chance, joiner = false } = cur.step;
    const iteration = cur.inLoop ? state.iteration : undefined;
    state = cur.after;
    if (chance !== undefined && rng() >= chance) continue;
    const text = generate(dict, section, rng);
    if (text === null) continue;
    return { ...state, segments: [...state.segments, { section, text, joiner, iteration }] };
  }
  return state;
}

export function finish(dict: Dictionary, s: State, rng: Rng = Math.random): State {
  if (s.done) return s;
  const text = generate(dict, dict.config.finish, rng);
  const segments = text === null ? s.segments : [...s.segments, { section: dict.config.finish, text, joiner: false }];
  return { ...s, segments, done: true };
}

// Joins segments into one prompt. A joiner (conjunction) swaps the previous full stop for a comma
// and lowercases the start of the next segment: "Like X, and like a Y."
export function render(segments: Segment[]): string {
  let out = "";
  let afterJoiner = false;
  for (const seg of segments) {
    if (seg.joiner) {
      out = out.replace(/[.!?]\s*$/, "") + ", " + seg.text;
      afterJoiner = true;
      continue;
    }
    const text = afterJoiner ? seg.text.charAt(0).toLowerCase() + seg.text.slice(1) : seg.text;
    out += (out ? " " : "") + text;
    afterJoiner = false;
  }
  return out;
}
