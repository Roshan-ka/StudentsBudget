import { readPref, useChoicePref } from '@/lib/phone-pref';
import { isSupabaseConfigured } from '@/lib/supabase/env';

// Whether the AI features can run here (the AI phase, chunk 5, docs/superpowers/plans/2026-11-09-ai-phase-1.md): in
// this build at all, and on this phone. The build needs a Supabase project and `NEXT_PUBLIC_AI=1`, set on Vercel only
// at go-live, so until then nothing of the AI shows. The phone's "Use AI features" switch (Settings → Your account) is
// on by default; turned off, quick add reads on the phone, Ask and the setup chat say how to turn it back on, and
// `callAi` sends nothing. Per phone, like the language: localStorage, never synced, never backed up.

/** Where this phone keeps its "Use AI features" switch: 'on' (the default, also for nothing stored) or 'off'. */
export const AI_PREF = 'studentsbudget-ai';

const CHOICES = ['on', 'off'] as const;

/** Whether this build has the AI features: a Supabase project and `NEXT_PUBLIC_AI=1`. Safe during render. */
export function aiInBuild(): boolean {
  // Written out in full, so Next puts the value in the build.
  return isSupabaseConfigured() && process.env.NEXT_PUBLIC_AI === '1';
}

/** Whether this phone's switch is on. Only in effects and event handlers: the page is prerendered with it on. */
export function aiOnHere(): boolean {
  return readPref(AI_PREF) !== 'off';
}

/** The switch as a hook: on in the first render (pages hydrate as built), this phone's choice right after. */
export function useAiSwitch(): [boolean, (on: boolean) => void] {
  const [choice, setChoice] = useChoicePref(AI_PREF, CHOICES, 'on');
  return [choice === 'on', (on: boolean) => setChoice(on ? 'on' : 'off')];
}
