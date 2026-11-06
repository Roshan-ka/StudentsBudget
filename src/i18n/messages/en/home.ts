// Home in English: the greeting, what is left to spend, the envelopes, the suggested budget and the accounts' total.
// A text that takes values is a function; one with a number picks its own plural, as each language's grammar needs.

const available = (amount: string) => `${amount} a month is available after your fixed costs and set-asides.`;

export const home = {
  greeting: (name: string) => `Hi ${name}`,
  acrossAccounts: (total: string) => `Across all accounts: ${total}`,
  /** "INR rate missing", or "INR and USD rates missing". */
  missingRates: (currencies: string, count: number) => `${currencies} ${count === 1 ? 'rate' : 'rates'} missing`,
  leftThisMonth: {
    heading: 'Left to spend this month',
    /**
     * "€12 over this month": the words around the amount, which the card writes large between them. A language puts
     * the amount where its grammar needs it; each part keeps its own spaces.
     */
    overThisMonth: { before: '', after: ' over this month' },
    weekOver: (amount: string) => `This week: ${amount} over`,
    weekSafe: (amount: string) => `This week: ${amount} safe to spend`,
  },
  envelopes: {
    heading: 'Envelopes',
    /** The bar's name: not the bare category name, which the hidden plan wizard's inputs also use. */
    barLabel: (category: string) => `${category} this month`,
    left: (left: string, planned: string) => `${left} left of ${planned} this month`,
    over: (over: string, planned: string) => `${over} over the ${planned} planned this month`,
  },
  suggestedBudget: {
    show: 'See a suggested budget',
    updated: 'Envelopes updated.',
    heading: 'Suggested budget',
    perMonth: (category: string) => `${category} per month`,
    studentsHere: 'Students here',
    lastMonth: (month: string) => `Your spending in ${month}`,
    nothingToGoOn: 'Nothing to go on yet',
    nothingAvailable:
      'Nothing is available to budget yet: your income leaves nothing after fixed costs and set-asides. ' +
      'You can change your plan in Settings → Plan.',
    available,
    availableWithinBudget: (amount: string, budget: string) =>
      `${available(amount)} These amounts keep to your everyday budget of ${budget}.`,
    availableBelowBudget: (amount: string, budget: string) =>
      `${available(amount)} That is less than your everyday budget of ${budget}, so these amounts keep to ${amount}.`,
    leftForSavings: (amount: string) => `${amount} left for savings`,
    overAvailable: (amount: string) => `${amount} over what is available`,
    use: 'Use this budget',
    notNow: 'Not now',
    moreCategories: 'More categories',
    replaces: 'Using it replaces the amounts in your envelopes.',
    fixAmounts: 'Fix the amounts marked above to use this budget.',
    enterOne: 'Enter at least one amount to use this budget.',
    failed: 'That did not save. Try again.',
  },
};
