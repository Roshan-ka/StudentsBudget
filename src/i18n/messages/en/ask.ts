// Ask in English (the AI phase, chunk 10, docs/superpowers/plans/2026-11-09-ai-phase-1.md): questions about the
// student's own budget, answered from their plan, their entries and the app's sourced Regensburg data.
export const ask = {
  intro:
    'Ask about your own budget: what is left, where your money goes, or how to spend less in Regensburg. The answers ' +
    'use your plan, your recent entries and the app’s sourced Regensburg data.',
  question: 'Your question',
  questionHint: 'At most 300 characters. Each question counts towards today’s six.',
  submit: 'Ask',
  thinking: 'Thinking…',
  /** The student's question in the conversation, for screen readers and the eye. */
  asked: 'You asked',
  answer: 'Answer',
  left: (count: number) => `${count} ${count === 1 ? 'question' : 'questions'} left today.`,
  full: 'That’s six questions in this conversation. Start over to ask more.',
  startOver: 'Start over',
  /** Under an answer with an amount nothing the model was given backs (`unbacked`). */
  estimate: 'Some amounts in this answer don’t come from your data or the sourced Regensburg data: take them as estimates.',
  sources: 'Sources',
  semester: (term: string, university: string) => `${term} at ${university}`,
  fee: (university: string) => `Semester fee at ${university}`,
  /** Why a question has no answer. */
  problems: {
    dailyLimit: 'That’s today’s questions used up. Ask again tomorrow.',
    busy: 'Ask is busy right now. Try again in a while.',
    refused: 'That’s a question Ask can’t answer here.',
    failed: 'Something went wrong with the answer. Try asking again.',
    unavailable: 'Ask can’t answer right now. Try again in a while.',
    offline: 'You’re offline. Ask needs a connection.',
    timeout: 'The answer took too long. Try asking again.',
  },
  unavailable: 'Ask isn’t part of this copy of the app.',
  loading: 'Loading…',
  signedOut: 'Ask works through your account: sign in on this phone first.',
  needsCode: 'Your account has two-step sign-in: enter the code from your authenticator app first.',
  toAccount: 'Go to Your account',
  switchedOff: 'AI features are off on this phone. You can turn them on again under Settings → Your account.',
  noPlan: 'Ask answers from your plan, so set it up first.',
  toSetup: 'Set up your plan',
  /** The chat bubble's name (13-11-2026; before, the quiet line on Home and on the check-in). */
  link: 'Ask about your budget',
  /** The chat sheet's close button, an icon (13-11-2026). */
  close: 'Close',
};
