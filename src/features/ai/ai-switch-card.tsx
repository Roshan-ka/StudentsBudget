'use client';

import { useId } from 'react';
import { cardVariants } from '@/components/ui/card';
import { useT } from '@/i18n/use-t';
import { aiInBuild, useAiSwitch } from './switch';

/**
 * Your account → AI features (the AI phase, chunk 5): this phone's "Use AI features" switch, on by default. Off, the AI
 * features send nothing (`callAi`). Only in a build with the AI, and only signed in, where the AI features are.
 */
export function AiSwitchCard() {
  const id = useId();
  const { t } = useT();
  const text = t.auth.ai;
  const [on, setOn] = useAiSwitch();
  if (!aiInBuild()) return null;
  return (
    <section aria-labelledby={`${id}-heading`} className={cardVariants()}>
      <h3 id={`${id}-heading`} className="text-xl leading-tight font-extrabold">
        {text.heading}
      </h3>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-primary"
          checked={on}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setOn(event.target.checked)}
        />
        {text.use}
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {text.hint}
      </p>
    </section>
  );
}
