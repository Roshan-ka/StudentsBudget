// Ask's conversation as the model gets it on Groq's free plan (the Groq switch, chunk 4,
// docs/superpowers/plans/2026-11-13-groq-free-plan.md): the last question, with the question before it and its answer,
// so a follow-up keeps its context while a sixth question costs no more tokens than a second. The app still sends every
// turn (contract.ts), and every earlier question still helps pick the city items (pack-select.ts).

import type { AskRequest } from './contract.ts';

type Turn = AskRequest['turns'][number];

/** The turns kept: the last question, and the question and answer before it. */
export const KEPT_TURNS = 3;

/**
 * The longest earlier answer kept, in characters (about 130 words); a longer one is cut at a space, with "…". It keeps
 * Ask's largest call at about 6,800 tokens (budget.test.ts).
 */
export const KEPT_ANSWER = 800;

/** `text` cut to `max` characters (never inside a character), at the last space in its second half when there is one. */
export function cutAnswer(text: string, max: number = KEPT_ANSWER): string {
  const characters = Array.from(text);
  if (characters.length <= max) return text;
  const cut = characters.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > cut.length / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The last `KEPT_TURNS` turns, starting and ending with the student, each earlier answer cut to `KEPT_ANSWER`. */
export function lastTurns(turns: readonly Turn[]): Turn[] {
  return turns
    .slice(-KEPT_TURNS)
    .map((turn) => (turn.role === 'assistant' ? { ...turn, text: cutAnswer(turn.text) } : turn));
}
