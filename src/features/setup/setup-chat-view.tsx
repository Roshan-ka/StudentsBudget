'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { callAi } from '@/features/ai/call';
import { MAX_SETUP_MESSAGE, setupAnswer } from '@/features/ai/contract';
import { askSourcesOf } from '@/features/ask/sources';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { useFocusOnMount } from '@/lib/focus';
import { cn } from '@/lib/utils';
import { applyPatch, draftForChat } from './chat-patch';
import type { DraftUpdate, SetupDraft } from './draft';
import { changeLines, chatFull, chatProblemText, setupRequestOf, type SetupTurn } from './setup-chat';
import { RangeSource } from './steps/range-source';

/** A reply: its words in the phone's language, what it filled in, and its sources from the app's own data. */
function Reply({ reply }: { reply: NonNullable<SetupTurn['reply']> }) {
  const { t, lang, locale } = useT();
  const text = t.setup.chat;
  const filled = changeLines(reply.changes, t, locale);
  const sources = askSourcesOf(reply.sourceIds, t, lang, locale);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{text.reply}</p>
      {/* The model was asked to answer in the phone's language. */}
      <p lang={lang} className="break-words whitespace-pre-line">
        {reply.text}
      </p>
      {filled.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{text.filled}</p>
          <ul className="list-disc ps-5 text-sm">
            {filled.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {sources.length > 0 && (
        <div className="flex flex-col">
          <p className="text-sm font-semibold">{text.sources}</p>
          {sources.flatMap((source) =>
            source.parts.map((part, i) => (
              <RangeSource key={`${source.id}-${i}`} range={part} label={t.common.source.of(part.label)} />
            )),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The setup chat (the AI phase, chunk 12, docs/superpowers/plans/2026-11-09-ai-phase-1.md), in the place of a new
 * setup's first step. Each message goes to the `ai` function with the draft as it is now; the reply's patch fills the
 * wizard's draft through `applyPatch`, and the reply lists what it filled in, with its sources. The AI never saves:
 * "Review the steps" closes the chat on the first step, and the student goes through the steps, where `validateStep`
 * holds as always, and taps Save. The first message on a phone waits for the `ai` data-protection note. Up to fifteen
 * messages, in memory only.
 */
export function SetupChatView({
  draft,
  update,
  accountsExist,
  today,
  onClose,
}: {
  draft: SetupDraft;
  update: DraftUpdate;
  /** Accounts were stored in Settings before setup: the chat leaves them alone. */
  accountsExist: boolean;
  today: IsoDate;
  onClose: () => void;
}) {
  const { t, lang } = useT();
  const text = t.setup.chat;
  const id = useId();
  // The chat opens on its field: a part that takes the step's place keeps the focus.
  const field = useFocusOnMount<HTMLTextAreaElement>();
  const inFlight = useRef<AbortController | null>(null);
  const [turns, setTurns] = useState<SetupTurn[]>([]);
  const [message, setMessage] = useState('');
  const [thinking, setThinking] = useState(false);
  const [noting, setNoting] = useState(false);

  // A page left for another stays mounted but hidden: the message in flight is dropped, and sent again by hand.
  useEffect(() => () => inFlight.current?.abort(), []);

  async function send() {
    const said = message.trim();
    if (said === '' || thinking) return;
    const request = setupRequestOf(turns, said, draftForChat(draft), lang, today);
    const controller = new AbortController();
    inFlight.current = controller;
    setThinking(true);
    setMessage('');
    setTurns((before) => [...before, { message: said, reply: null, problem: null }]);
    const result = await callAi(request, setupAnswer, { signal: controller.signal });
    if (inFlight.current === controller) inFlight.current = null;
    setThinking(false);
    if (!result.ok && result.problem === 'aborted') {
      setTurns((before) => before.slice(0, -1));
      setMessage(said);
      return;
    }
    if (!result.ok) {
      setTurns((before) => [...before.slice(0, -1), { message: said, reply: null, problem: result.problem }]);
      return;
    }
    // The draft as it was sent: nothing else changes it while the chat is open.
    const filled = applyPatch(draft, result.answer.patch, { accountsExist });
    update(() => filled.draft);
    const reply = { text: result.answer.reply, sourceIds: result.answer.sourceIds, changes: filled.changes };
    setTurns((before) => [...before.slice(0, -1), { message: said, reply, problem: null }]);
  }

  function start() {
    if (message.trim() === '' || thinking) return;
    if (noteSeen('ai')) void send();
    else setNoting(true);
  }

  const full = chatFull(turns);
  return (
    <div className="flex flex-col gap-4">
      <p>{text.intro}</p>
      {turns.length > 0 && (
        <ol className="flex flex-col gap-4">
          {turns.map((turn, i) => (
            <li key={i} className={cn(cardVariants(), 'gap-3')}>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{text.you}</p>
                <p className="font-semibold break-words whitespace-pre-line">{turn.message}</p>
              </div>
              {turn.reply && <Reply reply={turn.reply} />}
              {turn.problem && <p className="text-sm">{chatProblemText(turn.problem, text)}</p>}
            </li>
          ))}
        </ol>
      )}
      {thinking && <StatusLine className="text-sm">{text.thinking}</StatusLine>}

      {full ? (
        <p>{text.full}</p>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-message`}>{text.message}</Label>
            <Textarea
              ref={field}
              id={`${id}-message`}
              rows={3}
              maxLength={MAX_SETUP_MESSAGE}
              value={message}
              aria-describedby={`${id}-hint`}
              onChange={(event) => setMessage(event.target.value)}
            />
            <p id={`${id}-hint`} className="text-sm text-muted-foreground">
              {text.messageHint}
            </p>
          </div>
          {noting ? (
            <PrivacyNote
              id="ai"
              label={t.common.privacy.label}
              text={t.common.privacy.ai}
              continueLabel={t.common.privacy.continue}
              cancelLabel={t.common.privacy.cancel}
              onContinue={() => {
                setNoting(false);
                void send();
              }}
              onCancel={() => setNoting(false)}
            />
          ) : (
            <Button type="submit" size="lg" className="self-start" aria-disabled={thinking || message.trim() === ''}>
              {text.send}
            </Button>
          )}
        </form>
      )}
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => {
          inFlight.current?.abort();
          onClose();
        }}
      >
        {text.review}
      </Button>
    </div>
  );
}
