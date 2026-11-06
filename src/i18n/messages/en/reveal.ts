// The guess reveal in English: its card on Home, the page, and reveal-text.ts's month by month.

export const reveal = {
  card: {
    open: 'See how your guesses compare',
    label: 'Your guesses',
    unlocksOn: (day: string) => `Your guesses unlock on ${day}.`,
    whatsThis: "What's this?",
  },
  locked: {
    unlocksOn: (day: string) => `Your guesses unlock on ${day}. Keep logging.`,
    explain: (days: number) =>
      'At setup you guessed what you spend each month. ' +
      `After ${days} days of logging, you will see how your guesses compare with what you really spent.`,
  },
  listLabel: 'Your guesses',
  /** "You guessed €80. It was €190." */
  guessLine: (guessed: string, actual: string) => `You guessed ${guessed}. It was ${actual}.`,
  scaled: (from: string, to: string) => `Your spending from ${from} to ${to}, scaled to a month of 30 days.`,
  adjust: 'Edit plan',
  noGuesses: 'No guesses were saved in setup, so there is nothing to compare.',
  monthByMonth: 'Month by month',
  /** One finished month (recapLine): "October 2026: €15 left over → savings". */
  recap: {
    /** The month the plan was set up in, when that wasn't on the 1st: "October 2026 (counted from 16 Oct)". */
    partial: (month: string, from: string) => `${month} (counted from ${from})`,
    leftOver: (label: string, amount: string) => `${label}: ${amount} left over`,
    savings: (label: string, amount: string) => `${label}: ${amount} left over → savings`,
    over: (label: string, amount: string) => `${label}: ${amount} over plan`,
    onPlan: (label: string) => `${label}: right on plan`,
  },
  noPlan: 'Set up your plan to compare your guesses with what you spend.',
  startSetup: 'Start setup',
};
