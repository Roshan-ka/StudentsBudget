// The weekly check-in in English: its card on Home, the page, and week-line.ts (which the MCP server
// calls in English).

export const checkIn = {
  card: {
    title: 'Weekly check-in',
    sunday: "It's Sunday — time for your weekly check-in.",
    other: 'Your weekly check-in is on Sunday.',
  },
  /** The two sections of a part of the week: this week, or its days in the previous month. */
  thisWeek: {
    against: 'This week against your plan',
    logged: 'This week',
    empty: 'Nothing logged this week yet.',
  },
  earlierThisWeek: {
    against: 'Earlier this week against your plan',
    logged: 'Earlier this week',
    empty: 'Nothing logged earlier this week.',
  },
  noEnvelopes: 'No envelope has an amount in your plan.',
  /** One envelope's week (weekLine): "€70 planned · €20 spent · €50 under". */
  line: {
    planned: (planned: string, spent: string, verdict: string) => `${planned} planned · ${spent} spent · ${verdict}`,
    onPlan: 'on plan',
    under: (amount: string) => `${amount} under`,
    over: (amount: string) => `${amount} over`,
    usedUp: (spent: string) => `Nothing left this month · ${spent} spent`,
    usedUpOver: (spent: string, over: string) => `Nothing left this month · ${spent} spent · ${over} over`,
  },
  /** The week in one number (weekTotalLine). */
  total: {
    toSpend: (amount: string) => `In total: ${amount} to spend this week`,
    over: (amount: string) => `In total: ${amount} over this week`,
  },
  away: {
    lastWeek: 'I was away last week',
    thisWeek: 'I was away this week',
    hint:
      "A week away keeps your logging streak as it is and doesn't count towards Under-Budget Week or Ramen " +
      'Royalty.',
  },
  add: {
    heading: 'Forgot something? Add it here',
    earlier: 'Add something from an earlier day',
  },
  reminder: 'Add weekly reminder to calendar',
  reminderOr: 'Or a notification on this phone instead:',
  reminderOrLink: 'Weekly reminder',
  noPlan: 'Set up your plan to check in on your week.',
  startSetup: 'Start setup',
};
