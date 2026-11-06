// Settings → Weekly reminder in English (docs/superpowers/plans/2026-11-05-weekly-reminder.md, chunk 4): one calm line
// a week that it's time for the check-in, through the account, off until it is turned on.
export const reminder = {
  intro:
    'Once a week, this phone shows a short line that it’s time for your check-in. It says nothing about your money, ' +
    'and it’s off until you turn it on.',
  loading: 'Loading…',
  unavailable: 'Reminders aren’t set up in this copy of the app.',
  signedOut: 'The reminder comes through your account: sign in on this phone first.',
  toAccount: 'Go to Your account',
  needsCode: 'Your account has two-step sign-in: enter the code from your authenticator app first.',
  installFirst:
    'On an iPhone or iPad, the reminder needs the app on your Home Screen: in Safari, tap Share, then Add to Home ' +
    'Screen, and open it from there.',
  noPush: 'This browser can’t show reminders. The calendar reminder in the check-in works everywhere.',
  denied:
    'Notifications are blocked for StudentsBudget. Allow them in your phone’s or browser’s settings, then come back ' +
    'here.',
  day: 'Day',
  time: 'Time',
  hint: 'Whichever day you pick, the check-in looks at the week so far, Monday to Sunday.',
  turnOn: 'Turn on the reminder',
  save: 'Save changes',
  turnOff: 'Turn off',
  status: {
    on: (day: string, time: string) => `The reminder is on: ${day} at ${time}.`,
    off: 'The reminder is off.',
    dismissed: 'Nothing changed: notifications weren’t allowed.',
    notSupported: 'This browser’s push service isn’t one the app can send to.',
    failed: 'That didn’t work. Check your connection and try again.',
  },
  calendar:
    'Prefer your calendar? The check-in can add a weekly reminder to it instead. Use one of the two, so you don’t ' +
    'get both.',
  toCheckIn: 'Open the check-in',
  /** "Sundays at 18:00": a day that comes every week, at the start of a line. */
  everyDay: ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'],
  summaryOff: 'Off',
  summaryOn: (day: string, time: string) => `${day} at ${time}`,
};
