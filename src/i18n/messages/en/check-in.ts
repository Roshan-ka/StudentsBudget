// The weekly check-in in English: its card on Home, the page, and week-line.ts (which the MCP server
// calls in English).

export const checkIn = {
  card: {
    title: 'Weekly check-in',
    sunday: 'It’s Sunday — time for your weekly check-in.',
    other: 'Your weekly check-in is on Sunday.',
  },
  /**
   * The two sections of a part of the week: this week, or its days in the previous month. `bar` names an envelope's
   * bar: not the bare category name, which the hidden plan wizard's inputs also use. `logged` is also the week card's
   * label.
   */
  thisWeek: {
    envelopes: 'Envelopes this week',
    bar: (category: string) => `${category} this week`,
    logged: 'This week',
    empty: 'Nothing logged this week yet.',
  },
  earlierThisWeek: {
    envelopes: 'Envelopes earlier this week',
    bar: (category: string) => `${category} earlier this week`,
    logged: 'Earlier this week',
    empty: 'Nothing logged earlier this week.',
  },
  /**
   * The week card (16-11-2026): "€139 safe to spend", or "€9 over this week". The words around the amount, which the
   * card writes large between them; a language puts the amount where its grammar needs it, and each part keeps its own
   * spaces. Under the bar, what has gone so far; `bar` names the bar.
   */
  week: {
    safe: { before: '', after: ' safe to spend' },
    over: { before: '', after: ' over this week' },
    spent: (amount: string) => `${amount} spent so far`,
    bar: 'Spent this week',
  },
  noEnvelopes: 'No envelope has an amount in your plan.',
  /** One envelope's week (weekLine): "€20 of €70 · €50 under". */
  line: {
    of: (spent: string, planned: string, verdict: string) => `${spent} of ${planned} · ${verdict}`,
    onPlan: 'on plan',
    under: (amount: string) => `${amount} under`,
    over: (amount: string) => `${amount} over`,
    usedUp: (spent: string) => `Nothing left this month · ${spent} spent`,
    usedUpOver: (spent: string, over: string) => `Nothing left this month · ${spent} spent · ${over} over`,
  },
  /** The week in one number as a line (weekTotalLine), for the MCP server; the page shows it in the week card. */
  total: {
    toSpend: (amount: string) => `In total: ${amount} to spend this week`,
    over: (amount: string) => `In total: ${amount} over this week`,
  },
  away: {
    lastWeek: 'I was away last week',
    thisWeek: 'I was away this week',
    hint:
      'A week away keeps your logging streak as it is and doesn’t count towards Under-Budget Week or Ramen ' +
      'Royalty.',
  },
  add: {
    heading: 'Forgot something? Add it here',
    earlier: 'Add something from an earlier day',
  },
  reminder: 'Add a weekly reminder to your calendar',
  /** The calendar event's title, in its file (`public/weekly-check-in*.ics`, one per language; tested). */
  calendarEvent: 'StudentsBudget weekly check-in',
  reminderOr: 'Or a notification on this phone instead:',
  reminderOrLink: 'Weekly reminder',
  noPlan: 'Set up your plan to check in on your week.',
};
