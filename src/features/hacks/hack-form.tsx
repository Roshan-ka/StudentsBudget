'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { checkDraft, EMPTY_DRAFT, savePostingName, type PostingNameDraft } from './posting-name';
import { PostingNameFields } from './posting-name-fields';
import { checkHack, CITIES, EMPTY_HACK, HACK_CATEGORIES, postHack, type HackCity, type HackDraft } from './posts';

/**
 * Tips → Hacks → Post a hack (chunk 5): the text, its category and place, and an optional link. The first post on a
 * phone waits for its data-protection note; an account without a name picks one here first (the database asks for
 * it), and both are saved by the same Post.
 */
export function HackForm({ userId, onPosted, onCancel }: { userId: string; onPosted: () => void; onCancel: () => void }) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.tips.hacks.form;
  const [draft, setDraft] = useState<HackDraft>(EMPTY_HACK);
  // Set once the database said the account has no name: the name fields join the form.
  const [nameDraft, setNameDraft] = useState<PostingNameDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [postNote, setPostNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  /** `noteAccepted` comes from the note's Continue, so blocked storage can't loop the note. */
  async function submit(noteAccepted = false) {
    if (inFlight.current) return;
    setError(null);
    const checked = checkHack(draft);
    if (!checked.ok) return setError(text.errors[checked.problem]);
    const named = nameDraft === null ? null : checkDraft(nameDraft);
    if (named !== null && !named.ok) return setError(t.auth.postingName.errors[named.problem]);
    if (!navigator.onLine) return setError(text.errors.offline);
    const supabase = getSupabase();
    if (supabase === null) return;
    if (!noteAccepted && !noteSeen('post')) return setPostNote(true);
    setPostNote(false);

    inFlight.current = true;
    setBusy(true);
    try {
      if (named !== null) {
        const saved = await savePostingName(supabase, userId, named.name);
        if (saved !== 'saved') {
          setError(saved === 'taken' ? t.auth.postingName.errors.taken : t.auth.postingName.errors.saveFailed);
          return;
        }
      }
      const result = await postHack(supabase, checked.hack, lang);
      if (result === 'posted') {
        onPosted();
        return;
      }
      if (result === 'needs-username') {
        setNameDraft(EMPTY_DRAFT);
        setError(text.nameFirst);
        return;
      }
      const said = { 'daily-limit': text.errors.dailyLimit, invalid: text.errors.invalid, failed: text.errors.failed };
      setError(said[result]);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className={cn(cardVariants(), 'gap-3')}>
      <h3 id={`${id}-heading`} className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {nameDraft !== null && <PostingNameFields draft={nameDraft} onChange={setNameDraft} />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-body`}>{text.body}</Label>
          <Textarea
            id={`${id}-body`}
            lang={lang}
            maxLength={600}
            aria-describedby={`${id}-body-hint`}
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          />
          <p id={`${id}-body-hint`} className="text-sm text-muted-foreground">
            {text.bodyHint}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-category`}>{text.category}</Label>
          <NativeSelect
            id={`${id}-category`}
            className="w-full"
            value={draft.categoryId}
            onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
          >
            {HACK_CATEGORIES.map((categoryId) => (
              <NativeSelectOption key={categoryId} value={categoryId}>
                {categoryNameIn(t, categoryId)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-city`}>{text.city}</Label>
          <NativeSelect
            id={`${id}-city`}
            className="w-full"
            value={draft.city}
            onChange={(event) => setDraft({ ...draft, city: event.target.value as HackCity })}
          >
            {CITIES.map((city) => (
              <NativeSelectOption key={city} value={city}>
                {t.tips.hacks.cities[city]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-link`}>{text.link}</Label>
          <Input
            id={`${id}-link`}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={`${id}-link-hint`}
            value={draft.link}
            onChange={(event) => setDraft({ ...draft, link: event.target.value })}
          />
          <p id={`${id}-link-hint`} className="text-sm text-muted-foreground">
            {text.linkHint}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {postNote ? (
          <PrivacyNote
            id="post"
            label={t.common.privacy.label}
            text={t.common.privacy.post}
            continueLabel={t.common.privacy.continue}
            cancelLabel={t.common.privacy.cancel}
            onContinue={() => void submit(true)}
            onCancel={() => setPostNote(false)}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="px-4" disabled={busy}>
              {text.post}
            </Button>
            <Button type="button" variant="outline" className="px-4" disabled={busy} onClick={onCancel}>
              {text.cancel}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
