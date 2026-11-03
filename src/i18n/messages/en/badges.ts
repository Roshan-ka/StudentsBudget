// Badges in English: their names and progress lines (badges.ts), the badges page and the card on Home.

const weeks = (count: number) => `${count} ${count === 1 ? 'week' : 'weeks'}`;

export const badges = {
  names: {
    'under-budget-week': 'Under-Budget Week',
    'logging-streak': 'Logging Streak',
    'ramen-royalty': 'Ramen Royalty',
    'latte-survivor': 'Latte Survivor',
  },
  /** Where each badge stands. */
  progress: {
    underBudgetCount: (count: number) => `${count} weeks under budget`,
    underBudgetOf: (count: number, goal: number) => `${count} of ${goal} weeks`,
    streakStart: 'A streak starts with a week of envelope spending you log yourself',
    streakNew: 'A new streak starts with a week of envelope spending you log yourself',
    streakPaused: (count: number) => `Your streak is paused at ${weeks(count)}`,
    streakOf: (count: number, goal: number) => `${count} of ${goal} weeks in a row`,
    streakRun: (count: number) => `${weeks(count)} in a row`,
    ramenFirst: 'Your first full week of groceries sets the mark',
    /** `earned`: a cheaper week has earned it already, so nothing more is asked. */
    ramenBest: (amount: string, weekOf: string, earned: boolean) =>
      `Cheapest grocery week so far: ${amount} (week of ${weekOf})${earned ? '' : '. A cheaper week earns it'}`,
    latteFirstLogging: 'Your first full month of logging sets the mark',
    latteFirstEatingOut: 'Your first full month with eating out sets the mark',
    latteTarget: (amount: string, month: string) =>
      `A month with ${amount} or less on eating out earns it (half of what you spent in ${month})`,
    latteHit: (month: string, amount: string, markAmount: string, markMonth: string) =>
      `${month}: ${amount} on eating out, down from ${markAmount} in ${markMonth}`,
  },
  tiers: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' },
  notEarned: 'Not earned yet',
  earned: (date: string) => `Earned ${date}`,
  tierEarned: (tier: string, date: string) => `${tier} · earned ${date}`,
  /** What earns each badge, in full: the rules are published, not hidden. */
  rules: {
    underBudget: (gold: number, wholeSemester: boolean) =>
      'Counts a week in which you log envelope spending yourself and spend no more than its share of your envelopes: ' +
      'what was left of them at the start of the week, split over the weeks left in the month. ' +
      `Bronze at 4 weeks, silver at 12, gold at ${gold}${wholeSemester ? ': a whole semester' : ''}.`,
    streak: 'Weeks in a row in which you log envelope spending yourself. Earned at 4 weeks.',
    ramen: 'Earned by a full week that costs less in groceries than every week before it.',
    latte:
      'Earned by a month with at most half the eating out of your first full month that had some. ' +
      'Only months in which you log envelope spending yourself count.',
  },
  intro:
    'Each week is saved from the Wednesday after it ends, the next time you open the app, so spending you log for it ' +
    'on Monday or Tuesday still counts. Your badges come from those weeks and your entries. A week you mark as away ' +
    "in the check-in keeps your streak as it is and doesn't count towards Under-Budget Week or Ramen Royalty.",
  listLabel: 'Your badges',
  noPlan: 'Set up your plan to start earning badges.',
  startSetup: 'Start setup',
  card: {
    heading: 'Badges',
    earnedOf: (earned: number, total: number) => `${earned} of ${total} earned`,
    next: (name: string) => `Next: ${name}`,
    seeAll: 'See all badges',
  },
};
