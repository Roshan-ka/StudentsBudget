'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cardVariants } from '@/components/ui/card';
import { db } from '@/db/db';
import { refreshRates } from '@/db/rates';
import type { Plan } from '@/db/types';
import { sortAccounts } from '@/features/accounts/balances';
import { noteSeen } from '@/features/privacy/notes';
import { PrivacyNote } from '@/features/privacy/privacy-note';
import { useT } from '@/i18n/use-t';
import { todayIso } from '@/lib/dates';
import { usePageTitle } from '@/lib/page-title';
import { cn } from '@/lib/utils';
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
import { StepProblemsContext } from './step-problems';
import { AccountsStep } from './steps/accounts';
import { EnvelopesStep } from './steps/envelopes';
import { FixedStep } from './steps/fixed';
import { IncomeStep } from './steps/income';
import { OneOffsStep } from './steps/one-offs';

// The shorter setup (2026-11-05): Regensburg is the only city, so rent opens the fixed costs step, and one-off costs
// such as the semester fee are added later in Edit plan.
const NEW_STEPS: StepId[] = ['accounts', 'income', 'fixed', 'envelopes'];
// Accounts are edited in Settings, so editing skips them; it asks the one-off costs.
const EDIT_STEPS: StepId[] = ['income', 'fixed', 'one-offs', 'envelopes'];
// Accounts that already exist (added in Settings before setup) are kept, so a new setup skips that step.
const NEW_STEPS_WITH_ACCOUNTS: StepId[] = NEW_STEPS.filter((s) => s !== 'accounts');

function Wizard({
  edit,
  stored,
  storedAccounts,
  initialStep,
}: {
  edit: boolean;
  stored: Plan | null;
  /** Edit plan can open on a step (`?step=envelopes`, from the reveal's Adjust); a new setup always starts at the first. */
  initialStep: string | null;
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
  const [index, setIndex] = useState(() => (edit ? Math.max(0, steps.findIndex((s) => s === initialStep)) : 0));
  // After the first failed Next the messages follow the draft, so they go away as the person fixes things.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Next from the accounts step with a currency other than the euro waits for the note on the exchange rates.
  const [ratesNote, setRatesNote] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownIndex = useRef(index);
  const problemsId = useId();

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const existing = edit && stored ? stored : undefined;
  const problems = validateStep(step, draft, today, existing, storedAccounts, lang);
  const accounts = accountOptions(draft, storedAccounts, lang);
  usePageTitle(edit ? text.headingEdit : text.headingNew);

  useEffect(() => {
    // Not on first render: the page just loaded and nothing moved.
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    headingRef.current?.focus();
  }, [index]);

  // An account added in the accounts step gets its draft key here, so a line can pick it.
  const update: DraftUpdate = (change) => setDraft((d) => withAccountKeys(change(d)));

  /** `noteAccepted` comes from the note's Continue, so blocked storage can't loop the note. */
  function next(noteAccepted = false) {
    if (problems.length > 0) return setAttempted(true);
    setAttempted(false);
    const foreign = step === 'accounts' && draft.accounts.some((account) => account.currency !== 'EUR');
    if (foreign && !noteAccepted && !noteSeen('rates')) return setRatesNote(true);
    setRatesNote(false);
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
      {/* The page's heading: it names the page in the title, and takes the focus after a page change (RouteFocus). */}
      <h2
        data-page-heading
        tabIndex={-1}
        className="font-sans text-sm font-semibold tracking-normal text-muted-foreground outline-none"
      >
        {edit ? text.headingEdit : text.headingNew}
      </h2>
      <div className="flex flex-col gap-2">
        {/* One segment per step, filled up to this one: the line under it says the same in words. */}
        <div aria-hidden="true" className="flex gap-1">
          {steps.map((id, i) => (
            <span key={id} className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-primary' : 'bg-track')} />
          ))}
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{text.stepOf(index + 1, steps.length)}</p>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-[30px] leading-tight font-extrabold text-balance break-words outline-none"
        >
          {text.titles[step]}
        </h3>
      </div>

      {/* The step's fields in one card. While the problems show, the fields they name point at them. */}
      <StepProblemsContext value={attempted && problems.length > 0 ? problemsId : null}>
        <div className={cn(cardVariants(), 'gap-4')}>
          {step === 'accounts' && <AccountsStep draft={draft} update={update} />}
          {step === 'income' && !edit && accountsExist && (
            <p className="text-sm text-muted-foreground">{text.accountsInSettings}</p>
          )}
          {step === 'income' && (
            <IncomeStep draft={draft} update={update} accounts={accounts} today={today} edit={edit} />
          )}
          {step === 'fixed' && <FixedStep draft={draft} update={update} accounts={accounts} today={today} edit={edit} />}
          {step === 'one-offs' && <OneOffsStep draft={draft} update={update} today={today} existing={existing} />}
          {step === 'envelopes' && (
            <EnvelopesStep draft={draft} update={update} today={today} existing={existing} edit={edit} />
          )}
        </div>
      </StepProblemsContext>

      {attempted && problems.length > 0 && (
        <div id={problemsId} role="alert" className="text-sm text-destructive">
          <ul className="list-disc ps-5">
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

      {ratesNote && (
        <PrivacyNote
          id="rates"
          label={t.common.privacy.label}
          text={t.common.privacy.rates}
          continueLabel={t.common.privacy.continue}
          cancelLabel={t.common.privacy.cancel}
          onContinue={() => next(true)}
          onCancel={() => setRatesNote(false)}
        />
      )}

      {/* Across the width at the end of the step, not stuck to the bottom: a phone's keyboard would cover that. */}
      <div className={cn('flex flex-wrap gap-3', ratesNote && 'hidden')}>
        {index > 0 && (
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={back} disabled={saving}>
            {text.back}
          </Button>
        )}
        {isLast ? (
          <Button type="button" size="lg" className="flex-1" onClick={() => void save()} disabled={saving}>
            {text.save}
          </Button>
        ) : (
          <Button type="button" size="lg" className="flex-1" onClick={() => next()}>
            {text.next}
          </Button>
        )}
        {/* Editing saves from any step (pain points, chunk 7): save() checks every step and opens the first with a
            problem, so changing one envelope or the rent needs no walk through the rest. */}
        {edit && !isLast && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="basis-full"
            onClick={() => void save()}
            disabled={saving}
          >
            {text.save}
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
  const params = useSearchParams();
  const edit = params.get('edit') === '1';
  const initialStep = params.get('step');
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
  return (
    <Wizard
      key={`${edit ? 'edit' : 'new'}-${initialStep ?? ''}`}
      edit={edit}
      stored={loaded.plan}
      storedAccounts={loaded.accounts}
      initialStep={initialStep}
    />
  );
}
