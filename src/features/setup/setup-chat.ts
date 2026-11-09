import type { AiCallProblem } from '@/features/ai/call';
import { MAX_SETUP_MESSAGES, type SetupRequest } from '@/features/ai/contract';
import { categoryNameIn } from '@/i18n/category-name';
import type { Language } from '@/i18n/languages';
import type { Messages } from '@/i18n/messages';
import type { IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { ChatDraft, PatchChange } from './chat-patch';

// The setup chat on the phone (the AI phase, chunk 12, docs/superpowers/plans/2026-11-09-ai-phase-1.md): what the chat
// keeps in memory, the request each message sends, and how a turn says what it filled in. Nothing of it is stored:
// "Review the steps", leaving setup or a reload ends it; what it filled in stays in the wizard's draft until Save.

/** One message of the student's, and the chat's reply or why it has none (null while it is asked). */
export type SetupTurn = {
  message: string;
  reply: { text: string; sourceIds: string[]; changes: PatchChange[] } | null;
  problem: AiCallProblem | null;
};

/** The messages answered so far: only these go back to the model, each with the reply the chat showed. */
export const answeredTurns = (turns: readonly SetupTurn[]) => turns.filter((turn) => turn.reply !== null);

/** Whether the chat has its fifteen answered messages, so the steps take over from here. */
export const chatFull = (turns: readonly SetupTurn[]) => answeredTurns(turns).length >= MAX_SETUP_MESSAGES;

/** The request for a new message: the draft as it is now, the answered messages with their replies, then the new one. */
export function setupRequestOf(
  turns: readonly SetupTurn[],
  message: string,
  draft: ChatDraft,
  lang: Language,
  today: IsoDate,
): SetupRequest {
  const history = answeredTurns(turns).flatMap((turn) => [
    { role: 'user' as const, text: turn.message },
    { role: 'assistant' as const, text: turn.reply?.text ?? '' },
  ]);
  return { feature: 'setup', lang, today, draft, turns: [...history, { role: 'user', text: message }] };
}

/**
 * What a turn filled in, one line each in the phone's language: "Rent: €400.00", "Food: €310.00", "Everyday budget:
 * €600.00", or "Your accounts" for the accounts step, which has no single amount.
 */
export function changeLines(changes: readonly PatchChange[], t: Messages, locale: string): string[] {
  const text = t.setup.chat;
  return changes.map((change) => {
    if (change.what === 'accounts') return text.accounts;
    const name = change.what === 'budget' ? text.budget : categoryNameIn(t, change.what);
    return change.minor === undefined ? name : text.line(name, formatMoney(change.minor, 'EUR', { locale }));
  });
}

/** What the chat says when a message has no reply. */
export function chatProblemText(problem: AiCallProblem, text: Messages['setup']['chat']): string {
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
      return text.problems.signedOut;
    case 'second-step':
      return text.problems.needsCode;
    case 'off':
      return text.switchedOff;
    default:
      return text.problems.failed;
  }
}
