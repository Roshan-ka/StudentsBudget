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
    checked: (date: string) => `checked ${date}`,
  },
  /** What a number no page states says instead of a source (the data's `source: 'Estimate'`). */
  estimate: 'Estimate',
};
