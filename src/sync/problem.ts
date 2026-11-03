import type { Language } from '@/i18n/languages';
import { MESSAGES } from '@/i18n/messages';

/**
 * What stopped or troubled the last sync, as `syncState.problem` keeps it: a code, so the status says it in the
 * phone's language of the moment. `update-needed`: the account holds a row this app can't read. `signed-out`: the
 * session ran out. `failed`: anything else stopped it. `held:N`: synced, but N changes this app refuses stay queued.
 */
export type SyncProblem = 'update-needed' | 'signed-out' | 'failed' | `held:${number}`;

/** The problem of a sync that held back `count` changes (see push). */
export function heldBack(count: number): SyncProblem {
  return `held:${count}`;
}

const HELD = /^held:(\d+)$/;

/**
 * A stored problem in words, in `lang`. A sentence an earlier version of the app stored (before the codes) is shown
 * as it is, until the next sync replaces it.
 */
export function problemText(problem: string, lang: Language = 'en'): string {
  const text = MESSAGES[lang].sync.problems;
  if (problem === 'update-needed') return text.updateNeeded;
  if (problem === 'signed-out') return text.signedOut;
  if (problem === 'failed') return text.failed;
  const held = HELD.exec(problem);
  return held ? text.heldBack(Number(held[1])) : problem;
}
