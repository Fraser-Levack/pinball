// The prompt a player builds during one game. The first launch adds the flow's first section,
// then the next section is drawn as a goal: it's generated up front and revealed a couple of
// letters per score. A fully revealed goal is committed to the prompt and the next one is drawn. Game over
// throws away the unfinished goal and adds the finish section.

import { dictionary } from "./dictionary";
import { type Segment, type State, advance, finish, initialState, render } from "./engine";

// Letters revealed per score. Spaces don't count and are shown for free.
export const LETTERS_PER_SCORE = 2;

export interface PromptGoal {
  section: string;
  text: string;
  letters: number; // non-space characters in text
  revealed: number; // letters revealed so far
  next: State; // engine state once this goal is committed
}

export interface PromptRun {
  state: State; // completed sections only
  goal: PromptGoal | null;
  started: boolean;
}

export const createRun = (): PromptRun => ({ state: initialState(), goal: null, started: false });

// Whatever the engine adds next, held back as a goal. Null when the flow has nothing left.
function drawGoal(state: State): PromptGoal | null {
  const next = advance(dictionary, state);
  const seg: Segment | undefined = next.segments[state.segments.length];
  if (!seg) return null;
  const letters = seg.text.replace(/\s/g, "").length;
  return { section: seg.section, text: seg.text, letters, revealed: 0, next };
}

/** First launch of the game: the opening section goes straight in and the first goal is drawn. */
export function beginRun(run: PromptRun) {
  if (run.started) return;
  run.started = true;
  run.state = advance(dictionary, run.state);
  run.goal = drawGoal(run.state);
}

export interface Reveal {
  letters: string; // the letters this score uncovered
  completed: string | null; // section name when this score finished the goal
}

/** One score's worth of progress. */
export function revealToken(run: PromptRun): Reveal | null {
  const goal = run.goal;
  if (!goal || run.state.done) return null;
  const from = goal.revealed;
  goal.revealed = Math.min(goal.letters, goal.revealed + LETTERS_PER_SCORE);
  const letters = goal.text.replace(/\s/g, "").slice(from, goal.revealed);
  if (goal.revealed < goal.letters) return { letters, completed: null };
  run.state = goal.next;
  run.goal = drawGoal(run.state);
  return { letters, completed: goal.section };
}

/** Game over: drop the unfinished goal and sign off with the finish section. */
export function endRun(run: PromptRun) {
  if (!run.started || run.state.done) return;
  run.goal = null;
  run.state = finish(dictionary, run.state);
}

export const promptText = (run: PromptRun) => render(run.state.segments);

/** The goal text with every letter not yet revealed replaced by a block. */
export function maskedGoal(goal: PromptGoal): string {
  let shown = 0;
  return goal.text.replace(/\S/g, (ch) => (shown++ < goal.revealed ? ch : "▒"));
}
