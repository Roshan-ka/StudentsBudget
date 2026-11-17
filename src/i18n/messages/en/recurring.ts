// Recurring lines in English: Settings → Fixed costs and income, the setup wizard's schedule fields, the repeat fields
// and lines.ts's descriptions.

export const recurring = {
  heading: 'Fixed costs and income',
  intro:
    'Rent, income and other money that comes or goes on a set day. Envelopes and one-off costs are in Edit plan, above.',
  income: 'Income',
  fixedCosts: 'Fixed costs',
  noIncome: 'No income yet.',
  noFixedCosts: 'No fixed costs yet.',
  add: 'Add a fixed cost or income',
  saveFailed: 'Couldn’t save the change. Try again.',
  /** The line form's name: changing a line (as its Edit button is named), or adding one. */
  change: (name: string) => `Edit: ${name}`,
  newLine: 'New fixed cost or income',
  lineKind: 'Fixed cost or income',
  automatic: 'Add it automatically',
  autoHint: 'It’s added on its day — don’t log it by hand.',
  /** A new income line whose day this period has passed (review P1, 17-11-2026): add that one too, on Save. */
  thisMonthToo: 'Add this month too',
  thisWeekToo: 'Add this week too',
  thisPeriodHint: (date: string) => `Dated ${date}. Untick it if you’ve logged it already.`,
  newFrequency: 'A new frequency starts with the next period.',
  account: 'Account',
  /** The empty choice of the account picker, and a line's summary while its account is gone (lines.ts). */
  pickAccountOption: 'Pick an account',
  /** Under the picker of a line whose account is gone, and the form's error when it is saved without one. */
  pickAccount: 'Pick an account for this.',
  addedAgain: 'It’s added again from tomorrow.',
  amountIn: (currency: string) => `Amount in ${currency}`,
  eachTime: 'Each time it’s added.',
  eachTimeInPlan: (amount: string) => `Each time it’s added. In your plan: ${amount} a month.`,
  perMonth: 'Per month in your plan, in €',
  noAccountBelow: 'Add an account below to have this added automatically.',
  monthlyError: 'Enter what it comes to in euros a month, like 400.',
  save: 'Save',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',
  pause: 'Pause',
  resume: 'Resume',
  /** Each line's buttons, named by their word, then the line: "Edit: Rent". */
  editLine: (name: string) => `Edit: ${name}`,
  deleteLine: (name: string) => `Delete: ${name}`,
  pauseLine: (name: string) => `Pause: ${name}`,
  resumeLine: (name: string) => `Resume: ${name}`,
  deleteQuestion: (name: string) => `Delete ${name}?`,
  deleteNote: (name: string) => `Delete ${name}? Entries already added stay.`,
  /** The setup wizard's "Add it automatically" group for one line. */
  schedule: (name: string) => `${name} schedule`,
  noAccountSettings: 'Add an account in Settings → Accounts and transfers to have this added automatically.',
  pausedForNow: 'Paused for now. Resume it in Settings → Plan → Fixed costs and income.',
  keepsPlan: 'Each time it’s added. The euro amount stays your plan.',
  eachWeek: (amount: string) => `That’s ${amount} each week.`,
  repeats: 'Repeats',
  monthlyOnDay: 'Monthly on day',
  weeklyOn: 'Weekly on',
  day: 'Day',
  lastDay: 'In a shorter month it’s added on the last day.',
  /** lines.ts and schedule.ts. */
  firstAdded: (date: string) => `First added on ${date}.`,
  timingMonthly: (day: number) => `Monthly on day ${day}`,
  timingWeekly: (weekday: string) => `Weekly on ${weekday}`,
  notAutomatic: (amount: string) => `${amount} a month · Not added automatically`,
  paused: 'Paused',
  notInPlan: 'not in your plan for now',
  overIncome: (amount: string) => `Your plan is ${amount} over your income`,
};
