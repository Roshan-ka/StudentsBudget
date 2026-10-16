'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import { refreshRates } from '@/db/rates';
import { saveGuesses } from '@/db/repo';
import type { Plan } from '@/db/types';
import { todayIso } from '@/lib/dates';
import {
  draftFromPlan,
  draftToRecords,
  dropUnparsed,
  initialDraft,
  summarizeDraft,
  validateStep,
  type DraftUpdate,
  type SetupDraft,
  type StepId,
} from './draft';
import { AccountsStep } from './steps/accounts';
import { CityRentStep } from './steps/city-rent';
import { EnvelopesStep } from './steps/envelopes';
import { FixedStep } from './steps/fixed';
import { GuessesStep } from './steps/guesses';
import { IncomeStep } from './steps/income';
import { OneOffsStep } from './steps/one-offs';

const NEW_STEPS: StepId[] = ['city-rent', 'accounts', 'income', 'fixed', 'one-offs', 'guesses', 'envelopes'];
// Accounts are edited in Settings and guesses are locked, so editing skips both.
const EDIT_STEPS: StepId[] = NEW_STEPS.filter((s) => s !== 'accounts' && s !== 'guesses');

const TITLES: Record<StepId, string> = {
  'city-rent': 'City and rent',
  accounts: 'Accounts',
  income: 'Income',
  fixed: 'Fixed costs',
  'one-offs': 'One-off costs',
  guesses: 'Guesses',
  envelopes: 'Envelopes',
};

async function persist(records: ReturnType<typeof draftToRecords>, edit: boolean): Promise<void> {
  if (edit) {
    // Accounts and guesses are not part of editing; only the plan changes.
    await db.plan.put(records.plan);
    return;
  }
  await db.transaction('rw', db.accounts, db.plan, db.guesses, async () => {
    await db.accounts.bulkAdd(records.accounts);
    await db.plan.put(records.plan);
    await saveGuesses(records.guesses);
  });
}

function Wizard({ edit, stored }: { edit: boolean; stored: Plan | null }) {
  const router = useRouter();
  const steps = edit ? EDIT_STEPS : NEW_STEPS;
  const [today] = useState(() => todayIso());
  const [draft, setDraft] = useState<SetupDraft>(() => (edit && stored ? draftFromPlan(stored) : initialDraft()));
  const [index, setIndex] = useState(0);
  // After the first failed Next the messages follow the draft, so they go away as the person fixes things.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownIndex = useRef(index);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const existing = edit && stored ? stored : undefined;
  const problems = validateStep(step, draft, today);
  const overBy = isLast ? summarizeDraft(draft, today, existing).overByMinor : 0;

  useEffect(() => {
    // Not on first render: the page just loaded and nothing moved.
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    headingRef.current?.focus();
  }, [index]);

  const update: DraftUpdate = setDraft;

  function next() {
    if (problems.length > 0) return setAttempted(true);
    setAttempted(false);
    setIndex((i) => i + 1);
  }

  function back() {
    // Text that did not parse is gone once its field unmounts, so the draft must not keep the NaN.
    setDraft(dropUnparsed);
    setAttempted(false);
    setIndex((i) => i - 1);
  }

  async function save() {
    const failing = steps.findIndex((s) => validateStep(s, draft, today).length > 0);
    if (failing !== -1) {
      setIndex(failing);
      setAttempted(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await persist(draftToRecords(draft, today, existing), edit);
    } catch (error) {
      console.error('StudentsBudget: could not save the plan', error);
      setSaveError('Could not save your plan. Try again.');
      setSaving(false);
      return;
    }
    if (!edit) {
      // The accounts only exist now, so this is the first moment the INR rate can be fetched.
      try {
        await refreshRates(todayIso());
      } catch (error) {
        console.error('StudentsBudget: could not refresh the exchange rates', error);
      }
    }
    router.push('/');
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{edit ? 'Adjust your plan' : 'Set up your plan'}</h2>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Step {index + 1} of {steps.length}
        </p>
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {TITLES[step]}
        </h3>
      </div>

      {step === 'city-rent' && <CityRentStep draft={draft} update={update} />}
      {step === 'accounts' && <AccountsStep draft={draft} update={update} />}
      {step === 'income' && <IncomeStep draft={draft} update={update} />}
      {step === 'fixed' && <FixedStep draft={draft} update={update} />}
      {step === 'one-offs' && <OneOffsStep draft={draft} update={update} today={today} />}
      {step === 'guesses' && <GuessesStep draft={draft} update={update} />}
      {step === 'envelopes' && <EnvelopesStep draft={draft} update={update} today={today} existing={existing} />}

      {attempted && problems.length > 0 && (
        <div role="alert" className="text-sm text-destructive">
          <ul className="list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-destructive">
          {saveError}
        </p>
      )}

      <div className="flex gap-2">
        {index > 0 && (
          <Button type="button" variant="outline" className="h-10 px-4" onClick={back} disabled={saving}>
            Back
          </Button>
        )}
        {isLast ? (
          <Button type="button" className="h-10 px-4" onClick={() => void save()} disabled={saving || overBy > 0}>
            Save plan
          </Button>
        ) : (
          <Button type="button" className="h-10 px-4" onClick={next}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Reads the saved plan once, then hands it to the wizard. The wizard keeps its own draft, so a live
 * query here would let the save itself rewrite what the person is looking at.
 */
export function SetupWizard() {
  const router = useRouter();
  const edit = useSearchParams().get('edit') === '1';
  // undefined: still reading. null: no plan saved.
  const [stored, setStored] = useState<Plan | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    db.plan.get('current').then(
      (plan) => {
        if (!cancelled) setStored(plan ?? null);
      },
      (error: unknown) => {
        console.error('StudentsBudget: could not read the saved plan', error);
        if (!cancelled) setStored(null);
      },
    );
    return () => {
      cancelled = true;
      // The router keeps a page it has left mounted but hidden, with its state. Forget what was read
      // (and with it the draft), or a later visit would start from the plan as it was before this one.
      setStored(undefined);
    };
  }, []);

  // Editing needs a plan to edit; setting up must not run twice, or accounts would be added again.
  const redirectTo = stored === undefined ? null : edit && stored === null ? '/setup' : !edit && stored ? '/' : null;
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (stored === undefined || redirectTo) return null;
  return <Wizard key={edit ? 'edit' : 'new'} edit={edit} stored={stored} />;
}
