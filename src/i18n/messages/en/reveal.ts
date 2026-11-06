// The month-by-month recaps in English: Home's line to them, the page, and reveal-text.ts's lines.

export const reveal = {
  /** Home's line, for the latest month that is over: "See how October went". */
  link: (month: string) => `See how ${month} went`,
  intro: 'How each month that is over went against your envelopes.',
  /** Before the setup month is over: "Your first recap comes once October is over." */
  notYet: (month: string) => `Your first recap comes once ${month} is over.`,
  adjust: 'Change my envelopes',
  /** One finished month (recapLine): "October 2026: €15 left over → savings". */
  recap: {
    savings: (label: string, amount: string) => `${label}: ${amount} left over → savings`,
    over: (label: string, amount: string) => `${label}: ${amount} over plan`,
    onPlan: (label: string) => `${label}: right on plan`,
  },
  noPlan: 'Set up your plan to see how each month goes.',
  startSetup: 'Start setup',
};
