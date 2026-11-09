// Setup and Edit plan in English: the wizard, its steps, draft.ts's checks and lines, and the install hint.
// A text that takes values is a function; one with a number picks its own plural, as each language's grammar needs.

export const setup = {
  headingNew: 'Set up your plan',
  headingEdit: 'Edit plan',
  stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
  titles: {
    accounts: 'Accounts',
    income: 'Income',
    fixed: 'Fixed costs',
    'one-offs': 'One-off costs',
    envelopes: 'Envelopes',
  },
  accountsInSettings: 'Your accounts are already set up, in Settings → Accounts and transfers.',
  saveFailed: 'Could not save your plan. Try again.',
  back: 'Back',
  next: 'Next',
  save: 'Save plan',
  /** Why a step can't be left yet (validateStep). */
  problems: {
    checkAmount: (name: string) => `Check the amount for ${name}.`,
    addAccount: 'Add at least one account',
    nameAccounts: 'Give every account a name.',
    /** `name` is null for an account still without one. */
    checkOpening: (name: string | null, number: number) =>
      `Check the opening balance for ${name ?? `account ${number}`}.`,
    foreignAmount: (currency: string, name: string) => `Enter the amount in ${currency} for ${name}.`,
    nameOneOffs: 'Name every one-off cost.',
    /** `name` is null for a cost still without one. */
    checkOneOff: (name: string | null, number: number) => `Check the amount for ${name ?? `one-off cost ${number}`}.`,
    dueMonth: 'Pick a month after this one.',
    checkBudget: 'Check the amount for your everyday budget.',
    addEnvelope: (name: string) => `Add an amount for ${name}`,
  },
  accounts: {
    intro: 'Where does your money live? The opening balance is what is in each account today.',
    /** An account's group, and the name of one still without a name. */
    account: (number: number) => `Account ${number}`,
    name: 'Name',
    type: 'Type',
    bank: 'Bank',
    cash: 'Cash',
    currency: 'Currency',
    opening: 'Opening balance',
    remove: (number: number) => `Remove account ${number}`,
    add: 'Add account',
    /** The three accounts a new setup starts with: once saved, they are the person's own names. */
    prefilled: { localBank: 'Local bank', homeBank: 'Home bank', cash: 'Cash' },
  },
  income: {
    intro: 'How much comes in each month, in euros? Leave out what you do not get. If it varies, enter a low estimate.',
    /** One sentence around the switch's name, which is set in italics. */
    savings: {
      before: 'Living off savings? Add what you use each month under Other income and switch off ',
      automatic: 'Add it automatically',
      after: ", so money already in your account isn't counted twice.",
    },
    later: 'Get BAföG or a scholarship? Add it later in Settings → Plan → Edit plan.',
  },
  fixed: {
    intro: 'What do you pay every month, in euros? Leave out what you do not pay.',
    rentLabel: 'Rent per month',
    rooms: (range: string) => `Rooms here: ${range}`,
    later:
      'Subscriptions, the gym, utilities, the Rundfunkbeitrag and one-off costs like the semester fee can be added ' +
      'later in Settings → Plan → Edit plan.',
  },
  oneOffs: {
    intro:
      'Big costs that come once, like a semester fee or a deposit. We set a share aside each month until the due ' +
      "month. Skip this if you have none. A cost without an amount isn't saved.",
    oneOff: (number: number) => `One-off cost ${number}`,
    name: 'Name',
    amount: 'Amount',
    leftOut: "Without an amount, this cost isn't saved.",
    due: 'Due month',
    remove: (number: number) => `Remove one-off cost ${number}`,
    add: 'Add a one-off cost',
    /** "Add semester fee: €215, due March 2027"; `amount` is null when no page states the fee. */
    feeOffer: (amount: string | null, month: string) =>
      `Add semester fee${amount === null ? '' : `: ${amount}`}, due ${month}`,
  },
  /** How a sentence names each of the six core envelope categories (topicOf). */
  topics: {
    food: 'food & groceries',
    'eating-out': 'eating out',
    'going-out': 'going out',
    transport: 'transport',
    shopping: 'shopping',
    other: 'other things',
  },
  envelopes: {
    /** "…what is left after rent and fixed costs: €500." */
    budgetIntroNew: (amount: string) =>
      `An everyday budget is optional. Without one, the suggestions share out what is left after rent and fixed costs: ${amount}.`,
    budgetIntroEdit: (amount: string) =>
      'An everyday budget is optional. Without one, the suggestions share out what is left after rent, fixed costs ' +
      `and what is set aside for one-off costs: ${amount}.`,
    budgetQuestion:
      'How much do you want to spend in a month on everyday things, apart from rent and your fixed costs?',
    typicalSpend: (range: string) => `Students here typically spend about ${range} a month on these.`,
    /** "Eating out, going out and transport are estimates."; `list` is joined the language's way. */
    estimates: (list: string, count: number) =>
      `${list.charAt(0).toUpperCase()}${list.slice(1)} ${count === 1 ? 'is an estimate' : 'are estimates'}.`,
    whereFrom: 'Where this comes from',
    askEdit:
      'How much do you want to allow yourself for each of these a month, in euros? You can change these any time.',
    askNew:
      'How much do you want to allow yourself for each of these a month, in euros? You can change them, and add ' +
      'envelopes like study materials or travel, in Settings → Plan → Edit plan.',
    useSuggested: 'Use the suggested amounts',
    fillsOnly: "It fills only the envelopes you haven't set.",
    studentsHere: 'Students here',
    suggested: (amount: string) => `Suggested: ${amount}`,
    below: 'Below what students here typically need.',
    /** Above the envelopes when two or more are below (`count` is at least 2). */
    belowSome: (count: number) => `${count} of these are below what students here typically need.`,
  },
  /** draft.ts's lines: the envelopes footer, the budget line and a city range. */
  lines: {
    available: (amount: string) => `Available ${amount}`,
    planned: (amount: string) => `Planned ${amount}`,
    overBy: (amount: string) => `Over by ${amount}`,
    ofBudget: (planned: string, budget: string) => `${planned} of your ${budget} budget`,
    overBudget: (over: string, budget: string) => `${over} over your ${budget} budget`,
    range: (label: string, range: string) => `${label}: ${range}`,
    rangeEstimate: (label: string, range: string) => `${label}: ${range} (estimate)`,
  },
  installHint:
    'Install first: tap Share → Add to Home Screen, then set up there. Data entered in Safari stays in Safari.',
  /** The first row of the Settings list while no plan is saved: the way back to setup. */
  setupRow: { title: 'Set up your plan', summary: "Your plan isn't set up yet" },
  editPlan: {
    /** The Plan row on the Settings list. */
    summary: 'Income, fixed costs and envelopes',
    heading: 'Plan',
    body:
      'Change your envelopes, add one-off costs like the semester fee and the income sources, fixed costs and ' +
      'envelopes setup skipped, or go through the whole plan again.',
    link: 'Edit plan',
  },
};
