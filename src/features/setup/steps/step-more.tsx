import type { ReactNode } from 'react';
import { FoldSummary } from '@/components/link-button';

/**
 * A step's longer tips, folded under one question (Roshan, from the mockups, 13-11-2026), so the step shows its fields
 * first. The summary is an outlined button with a chevron (16-11-2026: buttons, never text links), at least 44 px high;
 * its chevron points along the reading direction and down once open.
 */
export function StepMore({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details>
      <FoldSummary>{summary}</FoldSummary>
      <div className="flex flex-col gap-2 pt-2 pb-1 text-sm text-muted-foreground">{children}</div>
    </details>
  );
}
