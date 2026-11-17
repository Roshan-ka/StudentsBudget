'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDaysIcon, UserIcon, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DateField } from '@/components/date-field';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { db } from '@/db/db';
import type { Profile } from '@/db/types';
import { categoryTint } from '@/features/charts/colors';
import { RowTile } from '@/features/home/row-card';
import { isIsoDate } from '@/features/recurring/schedule';
import { RangeSource } from '@/features/setup/steps/range-source';
import type { Messages } from '@/i18n/messages';
import { periodIn } from '@/i18n/city';
import { useT } from '@/i18n/use-t';
import { formatDate, type IsoDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToday } from '@/lib/use-today';
import { cn } from '@/lib/utils';
import {
  UNIVERSITIES,
  periodLabel,
  profileProblems,
  semesterFeeOffer,
  semesterOn,
  semesterWeeksOf,
  termName,
  toProfile,
  type ProfileDraft,
  type ProfileProblem,
  type SemesterFeeOffer,
} from './profile';
import { SemesterFeeSource } from './semester-fee-source';

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
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {t.profile.period(termName(period.term, lang), name, periodLabel(period, locale))}
      </p>
      <RangeSource range={periodIn(period, lang)} />
    </div>
  );
}

/** A card's title row: its tinted tile, its heading and, under it, an optional line (group 4 redesign, 17-11-2026). */
function CardTitle({
  id,
  icon,
  tint,
  line,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tint: string;
  line?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <RowTile icon={icon} tint={tint} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 id={id} className="text-lg leading-tight font-bold break-words">
          {children}
        </h3>
        {line !== undefined && <p className="text-sm text-muted-foreground">{line}</p>}
      </div>
    </div>
  );
}

/**
 * The next semester fee of the semester in the form, on the yellow accent card: its amount where a page states it, and
 * where each part comes from, as the one-off costs step shows it (`SemesterFeeSource`).
 */
function SemesterFeeCard({ offer }: { offer: SemesterFeeOffer }) {
  const id = useId();
  const { t, locale } = useT();
  const { amountMinor } = offer.row;
  return (
    <section aria-labelledby={id} className={cardVariants({ variant: 'accent' })}>
      <h3 id={id} className="text-lg leading-tight font-extrabold break-words">
        {t.profile.semesterFee}
      </h3>
      {amountMinor > 0 && (
        <p className="font-heading text-2xl leading-tight font-extrabold">
          {formatMoney(amountMinor, 'EUR', { whole: amountMinor % 100 === 0, locale })}
        </p>
      )}
      <SemesterFeeSource offer={offer} />
    </section>
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
  // Which date field holds text that is no date (DateField's `onNotADate`): Save asks about it, rather than taking
  // the empty date it reports as a cleared one.
  const [notADate, setNotADate] = useState({ semesterStart: false, semesterEnd: false });
  const startNotADate = useCallback(
    (bad: boolean) => setNotADate((now) => (now.semesterStart === bad ? now : { ...now, semesterStart: bad })),
    [],
  );
  const endNotADate = useCallback(
    (bad: boolean) => setNotADate((now) => (now.semesterEnd === bad ? now : { ...now, semesterEnd: bad })),
    [],
  );
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
    const found = profileProblems(draft, lang, notADate);
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
  // Under the semester's heading, once the form holds a semester it would save.
  const range = weeks === null ? undefined : `${formatDate(draft.semesterStart)} – ${formatDate(draft.semesterEnd)}`;
  // The semester in the form, as the one-off costs step reads the saved one; a planned fee doesn't hide it here, since
  // the card says what the fee is, not what to add. Null while the form holds no semester it would save.
  const feeOffer = semesterFeeOffer({ ...draft, id: 'current', updatedAt: '' }, today, [], lang);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <section aria-labelledby={`${id}-you`} className={cn(cardVariants(), 'gap-4')}>
        <CardTitle id={`${id}-you`} icon={UserIcon} tint={categoryTint('food')}>
          {text.you}
        </CardTitle>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-name`}>{text.name}</Label>
          <Input
            id={`${id}-name`}
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
      </section>
      <section aria-labelledby={`${id}-semester`} className={cn(cardVariants(), 'gap-4')}>
        <CardTitle id={`${id}-semester`} icon={CalendarDaysIcon} tint={categoryTint('eating-out')} line={range}>
          {text.semesterHeading}
        </CardTitle>
        <DateField
          chips={false}
          label={text.semesterStart}
          value={draft.semesterStart}
          invalid={startInvalid}
          describedBy={startInvalid ? problemsId : undefined}
          onNotADate={startNotADate}
          onChange={(semesterStart) => change({ semesterStart })}
        />
        <DateField
          chips={false}
          label={text.semesterEnd}
          value={draft.semesterEnd}
          min={draft.semesterStart || undefined}
          invalid={endInvalid}
          describedBy={endInvalid ? problemsId : undefined}
          onNotADate={endNotADate}
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
        {weeks !== null && <p className="text-sm text-muted-foreground">{text.weeks(weeks)}</p>}
        {/* A date picker has no reliable way to empty a field, and both dates are optional. */}
        {hasDates && (
          <Button
            type="button"
            variant="outline"
            className="self-start px-4"
            onClick={() => {
              change({ semesterStart: '', semesterEnd: '' });
              saveRef.current?.focus();
            }}
          >
            {text.clearDates}
          </Button>
        )}
      </section>
      {feeOffer && <SemesterFeeCard offer={feeOffer} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button ref={saveRef} type="submit" size="lg" className="w-full" aria-disabled={saving || undefined}>
        {text.save}
      </Button>
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
    // Named by its page's heading (/settings/profile), which has the id.
    // The intro, then a card each: you, your semester and its fee (group 4 redesign, Roshan's mockups, 17-11-2026).
    <section aria-labelledby="profile-heading" className="flex flex-col gap-4">
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
