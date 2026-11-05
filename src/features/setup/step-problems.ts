import { createContext, useContext } from 'react';

/**
 * The id of the step's list of problems while it shows (after a Next or Save that found some), else null. A field the
 * list speaks of marks itself invalid and points at it (accessibility, chunk 6): an unnamed account or one-off cost,
 * and an amount missing in another currency. A field whose text isn't an amount says so itself (`AmountField`).
 */
export const StepProblemsContext = createContext<string | null>(null);

export function useStepProblems(): string | null {
  return useContext(StepProblemsContext);
}
