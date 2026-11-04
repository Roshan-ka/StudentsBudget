// The Tips tab in English: the tips, the discounts and the swap line's words. The tips, discounts and swaps
// themselves are city content (src/data), translated by item in src/i18n/city.

export const tips = {
  tabsLabel: 'Tips or discounts',
  tips: 'Tips',
  discounts: 'Discounts',
  all: 'All',
  more: 'More',
  tipsIntro: 'Local ways students pay less. Each tip says where it comes from.',
  tipsFor: 'Show tips for',
  discountsIntro:
    'Student discounts in Regensburg. Each one says where it is stated. Tell the app whether one still works: your ' +
    'answers are saved on this phone. Ones you confirm move up; ones you mark as not working, or that haven’t been ' +
    'confirmed for 8 weeks, move down.',
  discountsFor: 'Show discounts for',
  loadFailed: 'The discounts could not be loaded. Try again later.',
  votes: { works: 'Still works', outdated: "Doesn't work anymore" },
  voteGroup: (place: string) => `${place}: does it still work?`,
  markedOutdated: (date: string) => `You marked this as not working on ${date}`,
  mayBeOutdated: 'May be outdated',
  lastConfirmed: (date: string) => `Last confirmed ${date}`,
  /** Other students' totals this semester (P2.6), shown while signed in. */
  confirmations: (count: number) => (count === 1 ? '1 confirmation this semester' : `${count} confirmations this semester`),
  notWorking: (count: number) =>
    count === 1 ? '1 student said it no longer works' : `${count} students said it no longer works`,
  othersSignIn: 'Sign in to see what other students confirmed.',
  saved: 'Saved on this phone.',
  saveFailed: 'Could not save your answer. Try again.',
  /** What a screen reader hears after a vote. */
  heard: {
    works: (place: string) => `${place}: saved as still working.`,
    outdated: (place: string) => `${place}: saved as not working.`,
    moves: (saved: string, direction: 'up' | 'down') => `${saved} It moves ${direction} the list.`,
    failed: (place: string) => `${place}: could not save your answer. Try again.`,
  },
  /** The swap line under an envelope: "Try this: … · save about €10 per meal". */
  swap: {
    line: (title: string, saving: string, per: string) => `Try this: ${title} · save about ${saving} per ${per}`,
    estimate: (line: string) => `${line} (estimate)`,
    details: (title: string) => `${title} details`,
    sources: 'Where these numbers come from',
    sourceOf: (amount: string) => `Where ${amount} comes from`,
    relatedTip: 'Related tip',
  },
};
