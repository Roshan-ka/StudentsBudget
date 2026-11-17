// The month-by-month recaps in English: Home's line to them, the page, and reveal-text.ts's lines.

export const reveal = {
  /** Home's line, for the latest month that is over: "See how October went". */
  link: (month: string) => `See how ${month} went`,
  intro: 'How each month that is over went against your envelopes.',
  /** Before the setup month is over: "Your first recap comes once October is over." */
  notYet: (month: string) => `Your first recap comes once ${month} is over.`,
  /** How one finished month went (recapResult), the big line under its name: "€15 left over → savings". */
  recap: {
    savings: (amount: string) => `${amount} left over → savings`,
    over: (amount: string) => `${amount} over plan`,
    onPlan: 'Right on plan',
  },
  /** Under the big line: the month's spending across the envelopes against their plan, "€462 spent of €500". */
  spentOf: (spent: string, planned: string) => `${spent} spent of ${planned}`,
  noPlan: 'Set up your plan to see how each month goes.',
};
