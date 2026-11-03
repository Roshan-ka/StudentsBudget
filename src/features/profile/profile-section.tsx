'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { DateField } from '@/components/date-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import type { Profile } from '@/db/types';
import { isIsoDate } from '@/features/recurring/schedule';
import { RangeSource } from '@/features/setup/steps/range-source';
import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/use-t';
import type { IsoDate } from '@/lib/dates';
import { useToday } from '@/lib/use-today';
import {
  UNIVERSITIES,
  periodLabel,
  profileProblems,
  semesterOn,
  semesterWeeksOf,
  termName,
  toProfile,
  type ProfileDraft,
  type ProfileProblem,
} from './profile';

const BLANK: ProfileDraft = { name: '', university: '', semesterStart: '', semesterEnd: '' };

/** A university as the form names it: UR and OTH by their own names, "Other" in the phone's language. */
const universityName = (university: (typeof UNIVERSITIES)[number], t: Messages): string =>
  university.id === 'other' ? t.profile.otherUniversity : university.name;

/** Where the semester dates of UR or OTH come from: the period the start date (or today) falls in, and its source. */
function PeriodSource({ draft, today }: { draft: ProfileDraft; today: IsoDate }) {
  const { t, lang, locale } = useT();
  const { university } = draft;
  if (university !== 'ur' && university !== 'oth') return null;
  const { period } = semesterOn(university, isIsoDate(draft.semesterStart) ? draft.semesterStart : today);
  const name = UNIVERSITIES.find((u) => u.id === university)?.name ?? university;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">
        {t.profile.period(termName(period.term, lang), name, periodLabel(period, locale))}
      </p>
      <RangeSource range={period} />
    </div>
  );
}

function ProfileForm({
  saved,
  today,
  onEdit,
  onSaved,
}: {
  saved: Profile | null;
  today: IsoDate;
  onEdit: () => void;
  /** Gets the saved row's `updatedAt`. */
  onSaved: (updatedAt: string) => void;
}) {
  const id = useId();
  const { t, lang } = useT();
  const text = t.profile;
  const [draft, setDraft] = useState<ProfileDraft>(() =>
    saved
      ? { name: saved.name, university: saved.university, semesterStart: saved.semesterStart, semesterEnd: saved.semesterEnd }
      : BLANK,
  );
  const [problems, setProblems] = useState<ProfileProblem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Save profile stays mounted, so focus can move to it when "Clear semester dates" unmounts under the person.
  const saveRef = useRef<HTMLButtonElement>(null);

  function change(update: Partial<ProfileDraft>) {
    setDraft((d) => ({ ...d, ...update }));
    setProblems([]);
    setError(null);
    onEdit();
  }

  function chooseUniversity(value: string) {
    const university = UNIVERSITIES.find((u) => u.id === value)?.id ?? '';
    if (university === 'ur' || university === 'oth') {
      // The current semester from the university's own dates; they stay editable.
      const { start, end } = semesterOn(university, today);
      change({ university, semesterStart: start, semesterEnd: end });
    } else {
      change({ university });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Not `disabled` while saving: that would push focus off the button.
    if (saving) return;
    const found = profileProblems(draft, lang);
    if (found.length > 0) return setProblems(found);
    setSaving(true);
    try {
      const profile = toProfile(draft, new Date());
      await db.profile.put(profile);
      setDraft((d) => ({ ...d, name: profile.name }));
      onSaved(profile.updatedAt);
    } catch (saveError) {
      console.error('StudentsBudget: could not save the profile', saveError);
      setError(text.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const weeks = semesterWeeksOf(draft);
  const problemsId = `${id}-problems`;
  // Only the field to fix is marked.
  const startInvalid = problems.some((p) => p.field === 'semesterStart');
  const endInvalid = problems.some((p) => p.field === 'semesterEnd');
  const hasDates = draft.semesterStart !== '' || draft.semesterEnd !== '';

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>{text.name}</Label>
        <Input
          id={`${id}-name`}
          className="h-10"
          value={draft.name}
          maxLength={40}
          autoComplete="given-name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={`${id}-name-hint`}
          onChange={(event) => change({ name: event.target.value })}
        />
        <p id={`${id}-name-hint`} className="text-sm text-muted-foreground">
          {text.nameHint}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-university`}>{text.university}</Label>
        <NativeSelect
          id={`${id}-university`}
          className="w-full"
          value={draft.university}
          onChange={(event) => chooseUniversity(event.target.value)}
        >
          <NativeSelectOption value="">{text.notSet}</NativeSelectOption>
          {UNIVERSITIES.map((u) => (
            <NativeSelectOption key={u.id} value={u.id}>
              {universityName(u, t)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <DateField
        chips={false}
        label={text.semesterStart}
        value={draft.semesterStart}
        invalid={startInvalid}
        describedBy={startInvalid ? problemsId : undefined}
        onChange={(semesterStart) => change({ semesterStart })}
      />
      <DateField
        chips={false}
        label={text.semesterEnd}
        value={draft.semesterEnd}
        min={draft.semesterStart || undefined}
        invalid={endInvalid}
        describedBy={endInvalid ? problemsId : undefined}
        onChange={(semesterEnd) => change({ semesterEnd })}
      />
      {problems.length > 0 && (
        <div id={problemsId} role="alert" className="text-sm text-destructive">
          {problems.map((problem) => (
            <p key={problem.message}>{problem.message}</p>
          ))}
        </div>
      )}
      <PeriodSource draft={draft} today={today} />
      {weeks !== null && (
        <p className="text-sm text-muted-foreground">{text.weeks(weeks)}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button ref={saveRef} type="submit" className="h-10 px-4" aria-disabled={saving || undefined}>
          {text.save}
        </Button>
        {/* A date picker has no reliable way to empty a field, and both dates are optional. */}
        {hasDates && (
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-4"
            onClick={() => {
              change({ semesterStart: '', semesterEnd: '' });
              saveRef.current?.focus();
            }}
          >
            {text.clearDates}
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Settings → Profile: an optional name, the university and the semester dates. One row in `db.profile`, which the
 * backup includes; it leaves the phone only when the user saves to their account.
 */
export function ProfileSection() {
  const { t } = useT();
  const text = t.profile;
  // The clock is only read in the browser, and the prefill needs it.
  const today = useToday();
  // 'loading' (no answer yet) and null (nothing saved) differ: the form opens with what was saved.
  const saved = useLiveQuery(() => db.profile.get('current').then((p) => p ?? null), [], 'loading' as const);
  // Which row is stored: its `updatedAt`, 'none', or null while loading.
  const stored = saved === 'loading' ? null : (saved?.updatedAt ?? 'none');
  // The row this form saved last, and whether "Profile saved." shows (until the next edit).
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  // The form opens again (a new key) when the stored row changes to one it did not save: the first read, a restore,
  // or Delete everything. Its own save keeps the key, so the form stays as it is and focus stays on Save.
  const [seen, setSeen] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (stored !== null && stored !== seen) {
    setSeen(stored);
    if (stored !== savedAt) {
      setFormKey((key) => key + 1);
      setSavedAt(null);
    }
  }
  const savedNotice = showSaved && stored !== null && stored === savedAt;
  // The router keeps Settings mounted but hidden and runs effect cleanups when the person leaves, so this clears the
  // notice then: back on the page later, "Profile saved." would no longer be news.
  useEffect(() => () => setShowSaved(false), []);

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-3">
      <h3 id="profile-heading" className="text-lg font-semibold">
        {text.heading}
      </h3>
      <p className="text-muted-foreground">{text.intro}</p>
      {saved !== 'loading' && today !== null && formKey > 0 && (
        <ProfileForm
          key={formKey}
          saved={saved}
          today={today}
          onEdit={() => setShowSaved(false)}
          onSaved={(updatedAt) => {
            setSavedAt(updatedAt);
            setShowSaved(true);
          }}
        />
      )}
      {/* Always rendered, so a screen reader is already listening when the text appears. A polite live region
          rather than role="status": Settings has other status lines that tests find by that role on the page. */}
      <p aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
        {savedNotice ? text.saved : null}
      </p>
    </section>
  );
}
