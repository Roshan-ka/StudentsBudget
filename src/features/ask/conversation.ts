import { MAX_QUESTIONS, type AskRequest } from '@/features/ai/contract';
import type { AiCallProblem } from '@/features/ai/call';
import type { AskReply } from '@/features/ai/contract';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import type { IsoDate } from '@/lib/dates';
import type { AskSnapshot } from './snapshot';

// An Ask conversation on the phone (the AI phase, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): what the
// page keeps in memory, and the request each new question sends. Nothing of it is stored: "Start over", leaving the
// app or a reload ends it.

/** One question, and its answer or why it has none (null while it is asked). */
export type AskTurn = { question: string; reply: AskReply | null; problem: AiCallProblem | null };

/** The questions answered so far: only these go back to the model, each with the answer the page showed. */
export const answeredTurns = (turns: readonly AskTurn[]) => turns.filter((turn) => turn.reply !== null);

/** Whether this conversation has its six answered questions and needs "Start over" for more. */
export const conversationFull = (turns: readonly AskTurn[]) => answeredTurns(turns).length >= MAX_QUESTIONS;

/** The request for a new question: the snapshot, the answered questions with their answers, then the new one. */
export function askRequestOf(
  turns: readonly AskTurn[],
  question: string,
  snapshot: AskSnapshot,
  lang: Language,
  today: IsoDate,
): AskRequest {
  const history = answeredTurns(turns).flatMap((turn) => [
    { role: 'user' as const, text: turn.question },
    { role: 'assistant' as const, text: turn.reply?.answer ?? '' },
  ]);
  return { feature: 'ask', lang, today, snapshot, turns: [...history, { role: 'user', text: question }] };
}

/** An answer as the page shows it: its paragraphs, apart where the model left a blank line. */
export function paragraphsOf(answer: string): string[] {
  return answer
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');
}

/** What the page says when a question has no answer. */
export function problemText(problem: AiCallProblem, text: Messages['ask']): string {
  switch (problem) {
    case 'daily-limit':
      return text.problems.dailyLimit;
    case 'busy':
      return text.problems.busy;
    case 'refused':
      return text.problems.refused;
    case 'unavailable':
      return text.problems.unavailable;
    case 'offline':
      return text.problems.offline;
    case 'timeout':
      return text.problems.timeout;
    case 'signed-out':
      return text.signedOut;
    case 'second-step':
      return text.needsCode;
    case 'off':
      return text.switchedOff;
    default:
      return text.problems.failed;
  }
}
