'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db/db';
import { refreshRates } from '@/db/rates';
import type { Plan } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';
import { useT } from '@/i18n/use-t';
import { todayIso } from '@/lib/dates';
import {
  accountOptions,
  draftFromPlan,
  draftToRecords,
  dropUnparsed,
  initialDraft,
  validateStep,
  withAccountKeys,
  type AccountOption,
  type DraftUpdate,
  type SetupDraft,
  type StepId,
} from './draft';
import { saveWizard } from './save-wizard';
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
// Accounts that already exist (added in Settings before setup) are kept, so a new setup skips that step.
const NEW_STEPS_WITH_ACCOUNTS: StepId[] = NEW_STEPS.filter((s) => s !== 'accounts');

function Wizard({
  edit,
  stored,
  storedAccounts,
}: {
  edit: boolean;
  stored: Plan | null;
  /** The accounts already saved: what a line can be added to when the wizard has no draft accounts. */
  storedAccounts: AccountOption[];
}) {
  const router = useRouter();
  const { t, lang } = useT();
  const text = t.setup;
  const accountsExist = storedAccounts.length > 0;
  const steps = edit ? EDIT_STEPS : accountsExist ? NEW_STEPS_WITH_ACCOUNTS : NEW_STEPS;
  const [today] = useState(() => todayIso());
  // The prefilled account names are in the language of the moment setup opens; once saved, they are the person's own.
  const [draft, setDraft] = useState<SetupDraft>(() =>
    edit && stored ? draftFromPlan(stored) : initialDraft(accountsExist, lang),
  );
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
  const problems = validateStep(step, draft, today, existing, storedAccounts, lang);
  const accounts = accountOptions(draft, storedAccounts, lang);

  useEffect(() => {
    // Not on first render: the page just loaded and nothing moved.
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    headingRef.current?.focus();
  }, [index]);

  // An account added in the accounts step gets its draft key here, so a line can pick it.
  const update: DraftUpdate = (change) => setDraft((d) => withAccountKeys(change(d)));

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
    const failing = steps.findIndex((s) => validateStep(s, draft, today, existing, storedAccounts, lang).length > 0);
    if (failing !== -1) {
      setIndex(failing);
      setAttempted(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await saveWizard(draftToRecords(draft, today, existing, storedAccounts), edit);
    } catch (error) {
      console.error('StudentsBudget: could not save the plan', error);
      setSaveError(text.saveFailed);
      setSaving(false);
      return;
    }
    if (!edit) {
      // The accounts only exist now, so this is the first moment the INR rate can be fetched. Not awaited:
      // the plan is saved, and the rate shows up through the live queries once it arrives.
      void refreshRates(todayIso()).catch((error: unknown) =>
        console.error('StudentsBudget: could not refresh the exchange rates', error),
      );
    }
    router.replace('/');
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{edit ? text.headingEdit : text.headingNew}</h2>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{text.stepOf(index + 1, steps.length)}</p>
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {text.titles[step]}
        </h3>
      </div>

      {step === 'city-rent' && <CityRentStep draft={draft} update={update} />}
      {step === 'accounts' && <AccountsStep draft={draft} update={update} />}
      {step === 'income' && !edit && accountsExist && (
        <p className="text-sm text-muted-foreground">{text.accountsInSettings}</p>
      )}
      {step === 'income' && <IncomeStep draft={draft} update={update} accounts={accounts} today={today} edit={edit} />}
      {step === 'fixed' && <FixedStep draft={draft} update={update} accounts={accounts} today={today} edit={edit} />}
      {step === 'one-offs' && <OneOffsStep draft={draft} update={update} today={today} existing={existing} />}
      {step === 'guesses' && <GuessesStep draft={draft} update={update} />}
      {step === 'envelopes' && (
        <EnvelopesStep draft={draft} update={update} today={today} existing={existing} edit={edit} />
      )}

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
          <Button type="button" variant="outline" className="px-4" onClick={back} disabled={saving}>
            {text.back}
          </Button>
        )}
        {isLast ? (
          <Button type="button" className="px-4" onClick={() => void save()} disabled={saving}>
            {text.save}
          </Button>
        ) : (
          <Button type="button" className="px-4" onClick={next}>
            {text.next}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Reads the saved plan and the saved accounts once, then hands them to the wizard. The wizard keeps
 * its own draft, so a live query here would let the save itself rewrite what the person is looking at.
 */
export function SetupWizard() {
  const router = useRouter();
  const edit = useSearchParams().get('edit') === '1';
  // undefined: still reading. `plan` is null when no plan is saved.
  const [loaded, setLoaded] = useState<{ plan: Plan | null; accounts: AccountOption[] } | undefined>(undefined);
  const stored = loaded?.plan;

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.plan.get('current'), db.accounts.toArray()]).then(
      ([plan, accounts]) => {
        // Kind and default mark come along, so a new line starts on the default account.
        const options = sortAccounts(accounts).map(({ id, name, currency, kind, isDefault }) => ({
          id,
          name,
          currency,
          kind,
          ...(isDefault && { isDefault }),
        }));
        if (!cancelled) setLoaded({ plan: plan ?? null, accounts: options });
      },
      (error: unknown) => {
        console.error('StudentsBudget: could not read the saved plan', error);
        if (!cancelled) setLoaded({ plan: null, accounts: [] });
      },
    );
    return () => {
      cancelled = true;
      // The router keeps a page it has left mounted but hidden, with its state. Forget what was read
      // (and with it the draft), or a later visit would start from the plan and accounts as they were
      // before this one.
      setLoaded(undefined);
    };
  }, []);

  // Editing needs a plan to edit; setting up must not run twice, or accounts would be added again.
  const redirectTo = stored === undefined ? null : edit && stored === null ? '/setup' : !edit && stored ? '/' : null;
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (loaded === undefined || redirectTo) return null;
  return <Wizard key={edit ? 'edit' : 'new'} edit={edit} stored={loaded.plan} storedAccounts={loaded.accounts} />;
}
