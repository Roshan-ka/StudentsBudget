// The Tips tab in English: the tips, the discounts and the swap line's words. The tips, discounts and swaps
// themselves are city content (src/data), translated by item in src/i18n/city.

export const tips = {
  tabsLabel: 'Tips, discounts, hacks or checklist',
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
  /** The Checklist tab (checklist plan, chunk 5): src/data/checklist.ts. */
  checklist: {
    tab: 'Checklist',
    intro:
      'What to get done in your first weeks, and money you may be able to claim. Each item says where it comes from. ' +
      'Your ticks are saved on this phone, and in your account once the phone is linked.',
    groups: { 'first-weeks': 'First weeks', money: 'Money to claim' },
    who: { everyone: 'Everyone', 'from-abroad': 'From outside the EU', bafoeg: 'On BAföG', 'under-25': 'Under 25' },
    progress: (done: number, total: number) => `${done} of ${total} done`,
    mark: 'Done',
    doneOn: (date: string) => `Done on ${date}`,
    /** The checkbox's name: its visible word, then the item. */
    markNamed: (title: string) => `Done: ${title}`,
    seeTip: 'See the tip',
    seeTipNamed: (title: string) => `See the tip: ${title}`,
    saveFailed: 'Could not save the tick. Try again.',
  },
  /** Discounts students added from the app (community, chunk 5): always marked, with who added them. */
  studentDiscounts: {
    tag: 'Added by a student',
    /** Its source line: who added it and when; the app never checked it, so no "checked" date shows. */
    source: (name: string, date: string) => `Added by ${name} on ${date}, not checked by the app`,
    /** Delete, Report and Translate say which discount, as on a post. */
    which: (place: string) => `the discount at ${place}`,
    deleteQuestion: 'Delete this discount? Nobody will see it anymore.',
    deleted: 'Discount deleted.',
    deleteFailed: "The discount couldn't be deleted. Try again.",
    reportQuestion: 'Report this discount? It disappears for you at once, and for everyone once enough students report it.',
    reported: 'Reported. You won’t see this discount anymore.',
    reportFailed: "The report couldn't be sent. Try again.",
    gone: "This discount isn't there anymore.",
    /** Tips → Discounts → Add a discount (community, chunk 6). */
    form: {
      open: 'Add a discount',
      heading: 'Add a discount',
      intro:
        'For a discount any student in Regensburg can get. It shows to signed-in students at once, under your name, marked as added by a student. No alcohol deals.',
      place: 'Place',
      placeHint: 'The shop, café or service. 2 to 80 characters.',
      offer: 'Offer',
      offerHint: 'What students get, like 10 % off with a student card. 3 to 120 characters.',
      conditions: 'Conditions (optional)',
      conditionsHint: 'When or how it works, like weekdays before 5 pm. Up to 300 characters.',
      address: 'Address (optional)',
      addressHint: 'Up to 120 characters.',
      category: 'Category',
      link: 'Source link',
      linkHint: 'The page that states the offer, starting with https://',
      add: 'Add',
      cancel: 'Cancel',
      added: 'Discount added.',
      nameFirst: 'First pick the name your posts go by.',
      errors: {
        placeShort: 'Name the place, with at least 2 characters.',
        placeLong: 'Keep the place to 80 characters.',
        offerShort: 'Say what the offer is, with at least 3 characters.',
        offerLong: 'Keep the offer to 120 characters.',
        conditionsLong: 'Keep the conditions to 300 characters.',
        addressLong: 'Keep the address to 120 characters.',
        link: 'Give the link to the page that states the offer, starting with https://',
        dailyLimit: "You've added 3 discounts in a day. Add more tomorrow.",
        invalid: "The discount couldn't be saved as it is. Check the fields and the link.",
        offline: "You're offline. Adding a discount needs a connection.",
        failed: "The discount couldn't be saved. Try again.",
      },
    },
  },
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
    /**
     * A post's Report, Delete and Translate say which post (accessibility, chunk 8): the button's own word, then the
     * post. `author` is the @username, null for a post without one.
     */
    which: (author: string | null, date: string) => (author === null ? `a post from ${date}` : `the post by ${author}, ${date}`),
    whichMine: (date: string) => `your post, ${date}`,
    named: (button: string, post: string) => `${button}: ${post}`,
    reportQuestion: 'Report this post? It disappears for you at once, and for everyone once enough students report it.',
    reportCancel: 'Cancel',
    reported: 'Reported. You won’t see this post anymore.',
    gone: "This post isn't there anymore.",
    voteFailed: "Your vote couldn't be saved. Try again.",
    reportFailed: "The report couldn't be sent. Try again.",
    moderation: {
      summary: 'Reported hacks',
      intro:
        'Posts and comments students reported, newest report first. Hide takes one out of every list; Keep shows it ' +
        'again and starts its report count afresh.',
      signedOut: 'Sign in with the moderator account to moderate.',
      notModerator: "This page is for the app's moderator.",
      needsCode:
        'Moderating needs a session that gave the authenticator code. Turn on two-step sign-in in Your account, ' +
        'then sign in again with the code.',
      loading: 'Loading reported posts…',
      loadFailed: "The reported posts couldn't be loaded.",
      tryAgain: 'Try again',
      empty: 'No reported posts.',
      queue: 'Reported posts',
      reports: (count: number) => (count === 1 ? '1 report since last kept' : `${count} reports since last kept`),
      states: { hand: 'Hidden by you', reports: 'Hidden by reports', visible: 'Visible' },
      hide: 'Hide',
      keep: 'Keep',
      hidden: 'Hidden from every feed.',
      kept: 'Kept: it shows again.',
      failed: "That didn't work. Try again.",
      /** The two sections (community, chunk 3). */
      postsHeading: 'Posts',
      commentsHeading: 'Comments',
      commentsQueue: 'Reported comments',
      commentsEmpty: 'No reported comments.',
      commentsLoadFailed: "The reported comments couldn't be loaded.",
    },
    /** Comments on a post (community, chunk 2): flat, oldest first. */
    comments: {
      /** The button that opens a post's comments, with how many there are. */
      toggle: (count: number) => (count === 0 ? 'Comments' : `Comments (${count})`),
      list: 'Comments',
      loading: 'Loading the comments…',
      loadFailed: "The comments couldn't be loaded. Try again later.",
      none: 'No comments yet.',
      body: 'Your comment',
      bodyHint: '3 to 300 characters. Every student with an account can read it.',
      post: 'Post comment',
      posted: 'Comment posted.',
      yours: 'Your comment',
      nameFirst: 'First pick the name your posts go by: Settings → Your account → Your name on posts.',
      errors: {
        short: 'Write at least 3 characters.',
        long: 'Keep it to 300 characters.',
        dailyLimit: "You've written 20 comments in a day. Comment again tomorrow.",
        gone: "This post isn't there anymore.",
        invalid: "The comment couldn't be saved as it is. Check the text.",
        offline: "You're offline. Commenting needs a connection.",
        failed: "The comment couldn't be saved. Try again.",
      },
      /** A comment's Report, Delete and Translate say which comment, as a post's do. */
      which: (author: string | null, date: string) =>
        author === null ? `a comment from ${date}` : `the comment by ${author}, ${date}`,
      whichMine: (date: string) => `your comment, ${date}`,
      deleteQuestion: 'Delete this comment? Nobody will see it anymore.',
      deleted: 'Comment deleted.',
      deleteFailed: "The comment couldn't be deleted. Try again.",
      reportQuestion: 'Report this comment? It disappears for you at once, and for everyone once enough students report it.',
      reported: 'Reported. You won’t see this comment anymore.',
      reportFailed: "The report couldn't be sent. Try again.",
    },
    translate: 'Translate',
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
