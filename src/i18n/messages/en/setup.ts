// Setup and Edit plan in English: the wizard, its steps, draft.ts's checks and lines, and the install hint.
// A text that takes values is a function; one with a number picks its own plural, as each language's grammar needs.

export const setup = {
  headingNew: 'Set up your plan',
  headingEdit: 'Adjust your plan',
  stepOf: (step: number, total: number) => `Step ${step} of ${total}`,
  titles: {
    'city-rent': 'City and rent',
    accounts: 'Accounts',
    income: 'Income',
    fixed: 'Fixed costs',
    'one-offs': 'One-off costs',
    guesses: 'Guesses',
    envelopes: 'Envelopes',
  },
  accountsInSettings: 'Your accounts are already set up in Settings.',
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
    checkGuess: (name: string) => `Check the guess for ${name}.`,
    checkBudget: 'Check the amount for your everyday budget.',
    addEnvelope: (name: string) => `Add an amount for ${name}`,
  },
  cityRent: {
    city: 'City',
    onlyCity: 'Regensburg is the only city for now.',
    rent: 'Rent per month',
    rooms: (range: string) => `Rooms here: ${range}`,
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
    later: 'Get BAföG or a scholarship? Add it later under Edit plan in Settings.',
  },
  fixed: {
    intro: 'What do you pay every month, in euros? Your rent is already in from step 1. Leave out what you do not pay.',
    later: 'Subscriptions, the gym, utilities and the Rundfunkbeitrag can be added later under Edit plan in Settings.',
    rent: (amount: string) => `Rent: ${amount} a month`,
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
  guesses: {
    intro:
      "Go with your gut, in euros. Enter 0 if you spend nothing on it. Skip any you're not sure about. Guesses " +
      "are saved once and can't be changed later.",
    question: (topic: string) => `What do you think you spend on ${topic} a month?`,
  },
  /** How a sentence names each of the six guess and envelope categories (topicOf). */
  topics: {
    food: 'food & groceries',
    'eating-out': 'eating out',
    'going-out': 'going out',
    transport: 'transport',
    shopping: 'shopping',
    other: 'other things',
  },
  envelopes: {
    budgetIntro: 'An everyday budget is optional: with one, each envelope below gets a suggested amount.',
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
      'envelopes like study materials or travel, under Edit plan in Settings.',
    useSuggested: 'Use the suggested amounts',
    fillsOnly: "It fills only the envelopes you haven't set.",
    studentsHere: 'Students here',
    suggested: (amount: string) => `Suggested: ${amount}`,
    below: 'Below what students here typically need.',
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
  editPlan: {
    /** The Plan row on the Settings list. */
    summary: 'Income, fixed costs and envelopes',
    heading: 'Plan',
    body:
      'Change your envelopes and one-off costs, add the income sources, fixed costs and envelopes setup skipped, or ' +
      "go through the whole plan again. Guesses from setup aren't changed.",
    link: 'Edit plan',
  },
};
