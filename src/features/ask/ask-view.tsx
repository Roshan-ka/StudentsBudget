'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { StatusLine } from '@/components/status-line';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/db/db';
import { useAuth } from '@/features/account/use-auth';
import { callAi } from '@/features/ai/call';
import { askReply, MAX_QUESTION, type AskReply } from '@/features/ai/contract';
import { aiInBuild, useAiSwitch } from '@/features/ai/switch';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { RangeSource } from '@/features/setup/steps/range-source';
import { useT } from '@/i18n/use-t';
import { cn } from '@/lib/utils';
import { useToday } from '@/lib/use-today';
import { askRequestOf, conversationFull, paragraphsOf, problemText, type AskTurn } from './conversation';
import { askSnapshot, type AskSnapshot } from './snapshot';
import { askSourcesOf } from './sources';

const linkClass = 'self-start text-sm font-semibold text-primary underline-offset-4 hover:underline';

/** One answer: its paragraphs in the phone's language, the estimate line when it needs one, and its sources. */
function Answer({ reply }: { reply: AskReply }) {
  const { t, lang, locale } = useT();
  const text = t.ask;
  const sources = askSourcesOf(reply.sourceIds, t, lang, locale);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{text.answer}</p>
      {/* The model was asked to answer in the phone's language. */}
      <div lang={lang} className="flex flex-col gap-2">
        {paragraphsOf(reply.answer).map((paragraph, i) => (
          <p key={i} className="break-words whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </div>
      {reply.unbacked.length > 0 && <p className="text-sm text-muted-foreground">{text.estimate}</p>}
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
 * Ask (the AI phase, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): questions about the student's own
 * budget, answered by the `ai` function from a snapshot of the plan and recent entries (`askSnapshot`, built once when
 * a conversation starts) and the sourced Regensburg data. Up to six questions a conversation, in memory only. The first
 * question on a phone waits for the `ai` data-protection note. A guest, an account owing its code, a phone with the AI
 * switched off or one without a plan is told why there is nothing to ask, and where to go.
 */
export function AskView() {
  const { t, lang } = useT();
  const text = t.ask;
  const auth = useAuth();
  const [aiOn] = useAiSwitch();
  const today = useToday();
  const plan = useLiveQuery(() => db.plan.get('current').then((p) => p ?? null), [], 'loading' as const);
  const entries = useLiveQuery(() => db.entries.toArray(), []);
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef<AbortController | null>(null);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [snapshot, setSnapshot] = useState<AskSnapshot | null>(null);
  const [question, setQuestion] = useState('');
  const [thinking, setThinking] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [noting, setNoting] = useState(false);

  // A page left for another stays mounted but hidden: the question in flight is dropped, and asked again by hand.
  useEffect(() => () => inFlight.current?.abort(), []);

  async function send() {
    const asked = question.trim();
    if (asked === '' || thinking || today === null || plan === 'loading' || plan === null || entries === undefined) return;
    const snap = snapshot ?? askSnapshot({ plan, entries }, today, t);
    setSnapshot(snap);
    const request = askRequestOf(turns, asked, snap, lang, today);
    const controller = new AbortController();
    inFlight.current = controller;
    setThinking(true);
    setQuestion('');
    setTurns((before) => [...before, { question: asked, reply: null, problem: null }]);
    const result = await callAi(request, askReply, { signal: controller.signal });
    if (inFlight.current === controller) inFlight.current = null;
    setThinking(false);
    if (!result.ok && result.problem === 'aborted') {
      setTurns((before) => before.slice(0, -1));
      setQuestion(asked);
      return;
    }
    setTurns((before) => {
      const last = before[before.length - 1];
      const done = result.ok ? { ...last, reply: result.answer } : { ...last, problem: result.problem };
      return [...before.slice(0, -1), done];
    });
    if (result.ok) setLeft(result.left);
  }

  function start() {
    if (question.trim() === '' || thinking) return;
    if (noteSeen('ai')) void send();
    else setNoting(true);
  }

  function startOver() {
    inFlight.current?.abort();
    setTurns([]);
    setSnapshot(null);
    setQuestion('');
    field.current?.focus();
  }

  const toAccount = (
    <Link href="/settings/account" className={linkClass}>
      {text.toAccount}
    </Link>
  );
  const said = (words: string, link?: React.ReactNode) => (
    <div className="flex flex-col gap-3">
      <p>{words}</p>
      {link}
    </div>
  );

  if (!aiInBuild()) return said(text.unavailable);
  if (auth.status === 'loading' || plan === 'loading' || entries === undefined) {
    return <p className="text-muted-foreground">{text.loading}</p>;
  }
  if (auth.status === 'signed-out' || auth.status === 'off') return said(text.signedOut, toAccount);
  if (auth.status === 'second-step') return said(text.needsCode, toAccount);
  if (!aiOn) return said(text.switchedOff, toAccount);
  if (plan === null) {
    return said(
      text.noPlan,
      <Link href="/setup" className={linkClass}>
        {text.toSetup}
      </Link>,
    );
  }

  const full = conversationFull(turns);
  return (
    <div className="flex flex-col gap-5">
      <p>{text.intro}</p>
      {turns.length > 0 && (
        <ol className="flex flex-col gap-4">
          {turns.map((turn, i) => (
            <li key={i} className={cn(cardVariants(), 'gap-3')}>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">{text.asked}</p>
                <p className="font-semibold break-words">{turn.question}</p>
              </div>
              {turn.reply && <Answer reply={turn.reply} />}
              {turn.problem && <p className="text-sm">{problemText(turn.problem, text)}</p>}
            </li>
          ))}
        </ol>
      )}
      {thinking && <StatusLine className="text-sm">{text.thinking}</StatusLine>}
      {left !== null && turns.some((turn) => turn.reply !== null) && (
        <p className="text-sm text-muted-foreground">{text.left(left)}</p>
      )}

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
            <Label htmlFor={`${id}-question`}>{text.question}</Label>
            <Textarea
              ref={field}
              id={`${id}-question`}
              rows={3}
              maxLength={MAX_QUESTION}
              value={question}
              aria-describedby={`${id}-hint`}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <p id={`${id}-hint`} className="text-sm text-muted-foreground">
              {text.questionHint}
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
            <Button type="submit" size="lg" className="self-start" aria-disabled={thinking || question.trim() === ''}>
              {text.submit}
            </Button>
          )}
        </form>
      )}
      {turns.length > 0 && (
        <Button type="button" variant="outline" className="self-start" onClick={startOver}>
          {text.startOver}
        </Button>
      )}
    </div>
  );
}
