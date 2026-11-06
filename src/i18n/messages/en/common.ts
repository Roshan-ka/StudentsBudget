// Text shared by several areas: the date field, the amount field and a city range's source.
export const common = {
  dateField: {
    label: 'Date',
    pickDay: 'Pick a day',
    today: 'Today',
    yesterday: 'Yesterday',
    /** A full date's parts as letters, which the empty field shows in the region's form: "DD.MM.YYYY". */
    letters: { day: 'D', month: 'M', year: 'Y' },
    /** Under the field; `example` is today's date in the region's form. */
    hint: (example: string) => `Type it like ${example}, or open the calendar.`,
    /** In place of the hint, for typed text that isn't a date. */
    notADate: (example: string) => `That’s not a date. Type it like ${example}.`,
    /** The calendar button's name, with the field's label: two date fields on a page are told apart. */
    openCalendar: (field: string) => `Open the calendar: ${field}`,
    calendarTitle: 'Choose a date',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    goToToday: 'Go to today',
    close: 'Close',
    /** A calendar day's name: "Friday, 06.11.2026" (the date in the region's form). */
    day: (weekday: string, date: string) => `${weekday}, ${date}`,
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
  /** One-time data-protection notes (`PrivacyNote`), each shown once per phone before a feature first sends data. */
  privacy: {
    label: 'About your data',
    continue: 'Continue',
    cancel: 'Cancel',
    account:
      'Your account is kept by Supabase, in Frankfurt (EU): your email, your password (stored only as a hash), ' +
      'your phone’s language, your username, label and batch, and a copy of the data you sync. Other students see ' +
      'only your username, label and batch, next to your posts. If the account needs a code, to confirm it or for ' +
      'a new password, it comes by email. You can delete the account at any time in Settings → Your account.',
    passkey:
      'Your phone’s password manager keeps the passkey, and may sync it to your other devices (iCloud Keychain or ' +
      'Google Password Manager, for example). Your account keeps only its public key, which can’t sign anyone in.',
    rates:
      'While an account uses a currency other than the euro, the app asks Frankfurter (frankfurter.dev) for the ' +
      'European Central Bank’s rate, at most once a day. It sends only the currency codes; like any website, ' +
      'Frankfurter sees your phone’s internet address.',
    votes:
      'Signed in, your votes go to your account when you sync, and count in the totals other students see for this ' +
      'semester. Nobody sees who voted.',
    post:
      'Every student with an account can read your post, with your username, label and batch, and vote on it or ' +
      'report it. You can delete it at any time.',
    hackVotes:
      'Your votes count in the totals every student sees on the post; nobody sees who voted. A report hides the ' +
      'post for you at once, and for everyone once enough students reported it, until the app’s moderator decides.',
    translate:
      'Translate opens Google Translate in a new tab, with the post’s text in its address. Google gets the text and ' +
      'your phone’s internet address.',
    reminder:
      'Your account (Supabase, in Frankfurt) keeps this phone’s push address, the day and time you pick, your time ' +
      'zone and your language, and updates the time zone and language when they change on the phone. The reminder ' +
      'goes through your browser maker’s push service (Apple, Google, Mozilla or Microsoft), which sees that a ' +
      'message arrives, but not what it says.',
  },
};
