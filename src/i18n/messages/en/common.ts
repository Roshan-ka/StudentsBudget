// Text shared by several areas: the date field, the amount field and a city range's source.
export const common = {
  dateField: {
    label: 'Date',
    pickDay: 'Pick a day',
    today: 'Today',
    yesterday: 'Yesterday',
  },
  amountField: {
    positive: 'Enter an amount above 0, like 250 or 12.50.',
    number: 'Enter a number, like 250 or 12.50.',
    overdrawn: 'Overdrawn (below zero)',
  },
  /** A city range's source, folded under its line. The source text itself is city content and stays English. */
  source: {
    label: 'Source',
    /** A source line that says what it covers: "Source: Eating out". */
    of: (what: string) => `Source: ${what}`,
    checked: (date: string) => `checked ${date}`,
  },
  /** An account in a picker: "Wise (INR)". */
  accountOption: (name: string, currency: string) => `${name} (${currency})`,
  /** What a set of data holds: "3 accounts", "1 entry", "your plan" (backup and sync). */
  counts: {
    accounts: (count: number) => `${count} ${count === 1 ? 'account' : 'accounts'}`,
    entries: (count: number) => `${count} ${count === 1 ? 'entry' : 'entries'}`,
    plan: 'your plan',
  },
  /** What a number no page states says instead of a source (the data's `source: 'Estimate'`). */
  estimate: 'Estimate',
};
