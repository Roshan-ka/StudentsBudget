'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { checkDraft, EMPTY_DRAFT, savePostingName, type PostingNameDraft } from '@/features/hacks/posting-name';
import { PostingNameFields } from '@/features/hacks/posting-name-fields';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { categoryNameIn } from '@/i18n/category-name';
import { useT } from '@/i18n/use-t';
import { describedBy } from '@/lib/described-by';
import { focusFirstControl } from '@/lib/focus';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  addDiscount,
  checkDiscount,
  DISCOUNT_CATEGORIES,
  EMPTY_DISCOUNT,
  PROBLEM_FIELD,
  type DiscountDraft,
} from './add-discount';

/** Which field a message is about: one of the discount's, the posting name's, or none (the whole form). */
type Field = keyof DiscountDraft | 'username' | 'batch' | null;

/**
 * Tips → Discounts → Add a discount (community, chunk 6): the place, the offer, optional conditions and address, its
 * category and the page that states it. It opens on its first field. The first post on a phone waits for the `post`
 * note, as a hack does; an account without a name picks one here first (the database asks for it), and both are saved
 * by the same Add.
 */
export function DiscountForm({ userId, onAdded, onCancel }: { userId: string; onAdded: () => void; onCancel: () => void }) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.tips.studentDiscounts.form;
  const [draft, setDraft] = useState<DiscountDraft>(EMPTY_DISCOUNT);
  // Set once the database said the account has no name: the name fields join the form.
  const [nameDraft, setNameDraft] = useState<PostingNameDraft | null>(null);
  const [error, setError] = useState<{ text: string; field: Field } | null>(null);
  const [postNote, setPostNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const errorId = `${id}-error`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit();
  }

  /** `noteAccepted` comes from the note's Continue, so blocked storage can't loop the note. */
  async function submit(noteAccepted = false) {
    if (inFlight.current) return;
    setError(null);
    const checked = checkDiscount(draft);
    if (!checked.ok) return setError({ text: text.errors[checked.problem], field: PROBLEM_FIELD[checked.problem] });
    const named = nameDraft === null ? null : checkDraft(nameDraft);
    if (named !== null && !named.ok) {
      return setError({
        text: t.auth.postingName.errors[named.problem],
        field: named.problem === 'batch' ? 'batch' : 'username',
      });
    }
    if (!navigator.onLine) return setError({ text: text.errors.offline, field: null });
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
          setError(
            saved === 'taken'
              ? { text: t.auth.postingName.errors.taken, field: 'username' }
              : { text: t.auth.postingName.errors.saveFailed, field: null },
          );
          return;
        }
      }
      const result = await addDiscount(supabase, checked.discount, lang);
      if (result === 'added') {
        onAdded();
        return;
      }
      if (result === 'needs-username') {
        setNameDraft(EMPTY_DRAFT);
        setError({ text: text.nameFirst, field: 'username' });
        return;
      }
      const said = { 'daily-limit': text.errors.dailyLimit, invalid: text.errors.invalid, failed: text.errors.failed };
      setError({ text: said[result], field: null });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** A field's own props: its hint, and the form's message while that message is about it. */
  const tied = (field: keyof DiscountDraft, hint: boolean) => ({
    id: `${id}-${field}`,
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': describedBy(hint && `${id}-${field}-hint`, error?.field === field && errorId),
  });

  const nameProblem = error?.field === 'username' || error?.field === 'batch' ? error.field : null;

  return (
    <section aria-labelledby={`${id}-heading`} className={cn(cardVariants(), 'gap-3')}>
      <h3 id={`${id}-heading`} className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      <form ref={focusFirstControl} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {nameDraft !== null && (
          <PostingNameFields draft={nameDraft} onChange={setNameDraft} problem={nameProblem} errorId={errorId} />
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-place`}>{text.place}</Label>
          <Input
            {...tied('place', true)}
            lang={lang}
            maxLength={100}
            value={draft.place}
            onChange={(event) => setDraft({ ...draft, place: event.target.value })}
          />
          <p id={`${id}-place-hint`} className="text-sm text-muted-foreground">
            {text.placeHint}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-offer`}>{text.offer}</Label>
          <Input
            {...tied('offer', true)}
            lang={lang}
            maxLength={150}
            value={draft.offer}
            onChange={(event) => setDraft({ ...draft, offer: event.target.value })}
          />
          <p id={`${id}-offer-hint`} className="text-sm text-muted-foreground">
            {text.offerHint}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-conditions`}>{text.conditions}</Label>
          <Textarea
            {...tied('conditions', true)}
            lang={lang}
            maxLength={350}
            value={draft.conditions}
            onChange={(event) => setDraft({ ...draft, conditions: event.target.value })}
          />
          <p id={`${id}-conditions-hint`} className="text-sm text-muted-foreground">
            {text.conditionsHint}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-address`}>{text.address}</Label>
          <Input
            {...tied('address', true)}
            autoComplete="off"
            maxLength={150}
            value={draft.address}
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
          />
          <p id={`${id}-address-hint`} className="text-sm text-muted-foreground">
            {text.addressHint}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-categoryId`}>{text.category}</Label>
          <NativeSelect
            {...tied('categoryId', false)}
            className="w-full"
            value={draft.categoryId}
            onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
          >
            {DISCOUNT_CATEGORIES.map((categoryId) => (
              <NativeSelectOption key={categoryId} value={categoryId}>
                {categoryNameIn(t, categoryId)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-link`}>{text.link}</Label>
          <Input
            {...tied('link', true)}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={draft.link}
            onChange={(event) => setDraft({ ...draft, link: event.target.value })}
          />
          <p id={`${id}-link-hint`} className="text-sm text-muted-foreground">
            {text.linkHint}
          </p>
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error.text}
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
            <Button type="submit" size="lg" className="px-4" disabled={busy}>
              {text.add}
            </Button>
            <Button type="button" variant="outline" size="lg" className="px-4" disabled={busy} onClick={onCancel}>
              {text.cancel}
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
