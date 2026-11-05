// The Tips tab in English: the tips, the discounts and the swap line's words. The tips, discounts and swaps
// themselves are city content (src/data), translated by item in src/i18n/city.

export const tips = {
  tabsLabel: 'Tips, discounts or hacks',
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
  /** The hacks feed: money-saving posts by students (docs/superpowers/plans/2026-11-05-hacks-feed.md). */
  hacks: {
    tab: 'Hacks',
    intro:
      'Money-saving hacks posted by students, in their own words. The app doesn’t check them: the votes show what ' +
      'worked.',
    signedOut: 'Sign in to read and post students’ hacks.',
    toAccount: 'Go to Your account',
    off: "Students' posts need an account, and accounts aren't set up in this copy of the app.",
    loading: 'Loading posts…',
    loadFailed: "The posts couldn't be loaded. Check your connection and try again.",
    tryAgain: 'Try again',
    lastLoaded: (when: string) => `Shown as last loaded, ${when}.`,
    empty: 'No posts yet.',
    postsFor: 'Show posts for',
    posts: 'Posts',
    cities: { regensburg: 'Regensburg', anywhere: 'Anywhere' },
    noName: 'A student',
    yours: 'Your post',
    form: {
      open: 'Post a hack',
      heading: 'Post a hack',
      body: 'Your hack',
      bodyHint: 'Say what, where and how much, if you know. 10 to 500 characters.',
      category: 'Category',
      city: 'Where',
      link: 'Link (optional)',
      linkHint: 'A page that shows it, starting with https://',
      post: 'Post',
      cancel: 'Cancel',
      posted: 'Posted.',
      nameFirst: 'First pick the name your posts go by.',
      errors: {
        short: 'Write at least 10 characters.',
        long: 'Keep it to 500 characters.',
        link: 'Give a link that starts with https://, or leave it empty.',
        dailyLimit: "You've posted 5 hacks in a day. Post again tomorrow.",
        invalid: "The post couldn't be saved as it is. Check the text and the link.",
        offline: "You're offline. Posting needs a connection.",
        failed: "The post couldn't be saved. Try again.",
      },
    },
    delete: 'Delete',
    deleteQuestion: 'Delete this post? Nobody will see it anymore.',
    keep: 'Keep it',
    deleted: 'Post deleted.',
    deleteFailed: "The post couldn't be deleted. Try again.",
    vote: { group: 'Your vote on this post', up: 'Upvote', worked: 'Worked for me', outdated: 'Outdated' },
    report: 'Report',
    reportQuestion: 'Report this post? It disappears for you at once, and for everyone once enough students report it.',
    reportCancel: 'Cancel',
    reported: 'Reported. You won’t see this post anymore.',
    gone: "This post isn't there anymore.",
    voteFailed: "Your vote couldn't be saved. Try again.",
    reportFailed: "The report couldn't be sent. Try again.",
    counts: (ups: number, worked: number, outdated: number) =>
      `Upvotes: ${ups} · Worked: ${worked} · Outdated: ${outdated}`,
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
