// Charts in English: the period and month controls, the four charts, their legends, tooltips, tables and what a
// screen reader hears for each chart.

/** Sentences joined with a space, leaving out the ones that aren't there. */
const sentences = (...parts: (string | null)[]) => parts.filter((part) => part !== null).join(' ');

export const charts = {
  noPlan: 'Set up your plan to see where the money goes.',
  startSetup: 'Start setup',
  /** The period control: "This month", "3 months". */
  periodLabel: 'Period',
  period: (months: number) => (months === 1 ? 'This month' : `${months} months`),
  monthLabel: 'Month',
  previous: 'Previous',
  next: 'Next',
  /** A period of more than one month, in a sentence: "August 2026 to October 2026". */
  periodRange: (first: string, last: string) => `${first} to ${last}`,
  /** The months of a longer period in "nothing yet": "these 3 months". */
  theseMonths: (months: number) => `these ${months} months`,
  noSpending: (when: string) => `No spending logged in ${when} yet.`,
  noIncome: (when: string) => `No income logged in ${when} yet.`,
  nothing: (when: string) => `Nothing logged in ${when} yet.`,
  lastSixMonths: 'Last 6 months',
  /** The series' names, in the legend and the tooltip. */
  series: {
    spent: 'Spent',
    planned: 'Planned',
    income: 'Income',
    saved: 'Saved',
    short: 'More spent than earned',
  },
  /** A bar with a plan: "€20 of €160". */
  ofPlanned: (amount: string, planned: string) => `${amount} of ${planned}`,
  /** What the slice of everything that didn't fit in the top 6 is called. */
  bucket: 'Everything else',
  /** Category names too long beside a slice or a bar; the table and the tooltip keep the full name. */
  shortNames: { utilities: 'Utilities', 'transport-pass': 'Transport pass', health: 'Health' },
  styles: { donut: 'Donut', bars: 'Bars', table: 'Table', columns: 'Columns', line: 'Line' },
  spending: {
    title: 'Spending by category',
    styleLabel: 'Spending chart style',
    category: 'Category',
    notPlanned: 'Not planned',
    nothingSpent: (period: string) => `Nothing spent in ${period} yet.`,
    /** The word under the total in the donut's middle. */
    centre: 'spent',
    caption: (period: string) => sentences(`Spending by category, ${period}.`, 'Each category links to its entries.'),
    donutSummary: (period: string, slices: string) =>
      sentences(`Donut chart of what was spent in ${period}: ${slices}.`, 'The same numbers are listed under it.'),
    barsSummary: (period: string, withPlanned: boolean) =>
      sentences(
        `Bar chart of what was spent in each category in ${period}${withPlanned ? ', against what was planned' : ''}.`,
        'The same numbers are in the table.',
      ),
  },
  income: {
    title: 'Income by source',
    styleLabel: 'Income chart style',
    source: 'Source',
    centre: 'income',
    caption: (period: string) => `Income by source, ${period}. Each source links to its entries.`,
    donutSummary: (period: string, slices: string) =>
      `Donut chart of the income in ${period} by source: ${slices}. The same numbers are listed under it.`,
    barsSummary: (period: string) => `Bar chart of the income in ${period} by source. The same numbers are in the table.`,
  },
  savings: {
    title: 'Saved each month',
    styleLabel: 'Savings chart style',
    month: 'Month',
    saved: (amount: string) => `${amount} saved`,
    short: (amount: string) => `${amount} more spent than earned`,
    explain: (period: string) => `Income minus spending, ${period}. Money moved between your accounts is left out.`,
    caption: (period: string) => `Income minus spending by month, ${period}. Each month links to its entries.`,
    summary: (line: boolean, period: string, headline: string) =>
      `${line ? 'Line' : 'Column'} chart of income minus spending in each month of ${period}, ${headline}. The same numbers are in the table.`,
  },
  overTime: {
    title: (category: string) => `${category} over time`,
    category: 'Category',
    styleLabel: 'Category chart style',
    caption: (category: string, period: string) => `${category} by month, ${period}. Each month links to its entries.`,
    summary: (line: boolean, category: string, period: string) =>
      `${line ? 'Line' : 'Column'} chart of what was spent on ${category} in each month of ${period}. The same numbers are in the table.`,
  },
};
