// Generates the manual demo pack: accepted and rejected backup files, manifest.json (the expected figures that
// src/features/backup/demo-fixtures.test.ts checks against the app's real functions) and CASES.md.
// The hand-written guide, fixtures/manual-demo/README.md, is never touched. Read it first.
//
// Usage: node scripts/generate-demo-fixtures.mjs [--date YYYY-MM-DD] [--out <folder>]
//   --date  the day the pack is for (default: today in Europe/Berlin). Dates in the files, and every figure that
//           depends on "today" (Home's week, recurring postings, badge weeks), follow it.
//   --out   where to write (default: fixtures/manual-demo/, the committed snapshot for 21-10-2026). For any other
//           date use a temp or git-ignored folder, or the tracked files change.
// It first deletes the .json files in <out>/valid and <out>/invalid, so a renamed file leaves nothing stale behind.
// The output is deterministic: the same --date gives the same bytes.
//
// Needs Node 24. It imports the .ts catalogs and src/lib/money.ts directly through Node's built-in type stripping,
// so no build or Next server is needed. That only works while those files use erasable TypeScript: `import type`,
// type annotations, no enums, namespaces or path aliases.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES } from '../src/data/categories.ts';
import { DISCOUNTS } from '../src/data/discounts.ts';
import { formatMoney } from '../src/lib/money.ts';

const usage = 'Usage: node scripts/generate-demo-fixtures.mjs [--date YYYY-MM-DD] [--out <folder>]';
const options = new Map();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  const [name, value] = [args[i], args[i + 1]];
  if (!['--date', '--out'].includes(name) || !value || value.startsWith('--') || options.has(name)) throw new Error(usage);
  options.set(name, value);
}
const root = options.has('--out')
  ? pathToFileURL(path.resolve(options.get('--out')) + path.sep)
  : new URL('../fixtures/manual-demo/', import.meta.url);
const today = options.get('--date') ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || new Date(`${today}T12:00:00Z`).toISOString().slice(0, 10) !== today) {
  throw new Error('Use a real date in YYYY-MM-DD format.');
}
const month = today.slice(0, 7);
const stamp = `${today}T10:00:00.000Z`;
const day = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const shiftMonth = (m, n) => {
  const d = new Date(`${m}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
const monday = day(today, 1 - weekday);
const lastSunday = day(monday, weekday >= 3 ? -1 : -8);
const clone = structuredClone;
const ddmmyyyy = (d) => d.split('-').reverse().join('-');
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthLabel = (m) => `${monthNames[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
// Home's "This week" for the clean budget, worked out here without the app's code (the test compares it with weekToSpend):
// the month's envelopes split over the Monday–Sunday weeks left in the month, this one included.
const monthEnd = day(`${shiftMonth(month, 1)}-01`, -1);
const weeksLeft = Math.floor((Date.parse(`${monthEnd}T12:00:00Z`) - Date.parse(`${monday}T12:00:00Z`)) / 86400000 / 7) + 1;
const cases = [];
for (const folder of ['valid', 'invalid']) {
  const dir = new URL(`${folder}/`, root);
  mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(dir)) if (file.endsWith('.json')) rmSync(new URL(file, dir));
}

function base() {
  return {
    app: 'studentsbudget', version: 3, exportedAt: stamp,
    data: {
      accounts: [
        { id: 'bank', name: 'Demo EUR bank', kind: 'bank', currency: 'EUR', openingMinor: 100000, createdAt: '2025-01-01T08:00:00Z', isDefault: true },
        { id: 'cash', name: 'Demo cash', kind: 'cash', currency: 'EUR', openingMinor: 10000, createdAt: '2025-01-01T09:00:00Z' },
      ],
      categories: clone(CATEGORIES), entries: [], guesses: [], fxRates: [], weekResults: [], discountVotes: [], profile: null,
      plan: {
        id: 'current', cityId: 'regensburg', createdOn: `${shiftMonth(month, -12)}-01`,
        incomes: [{ categoryId: 'income-parents', monthlyMinor: 120000 }],
        fixed: [{ categoryId: 'rent', monthlyMinor: 45000 }, { categoryId: 'phone', monthlyMinor: 2000 }, { categoryId: 'insurance', monthlyMinor: 3000 }],
        envelopes: ['food', 'eating-out', 'going-out', 'transport', 'shopping', 'other'].map((categoryId, i) => ({ categoryId, monthlyMinor: [25000, 8000, 4000, 3000, 6000, 4000][i] })),
        spendingBudgetMinor: 50000, oneOffs: [],
      },
    },
  };
}
function entry(file, categoryId, amountMinor, options = {}) {
  const row = {
    id: `entry-${file.data.entries.length + 1}`, type: 'expense', date: today,
    accountId: 'bank', categoryId, amountMinor, eurMinor: amountMinor,
    note: `Demo ${categoryId}`, createdAt: stamp, ...options,
  };
  file.data.entries.push(row);
  return row;
}
function schedule(id, overrides = {}) {
  return { id, frequency: 'monthly', day: Number(today.slice(-2)), accountId: 'bank', amountMinor: 45000,
    startOn: `${month}-01`, postedThrough: day(`${month}-01`, -1), ...overrides };
}
function rate(currency, perEur) {
  return { currency, perEur, rateDate: today, fetchedOn: today, source: 'manual' };
}
function savedWeek(end, food = 1000, paused = false) {
  return { weekStart: day(end, -6), weekEnd: end, plannedMinor: 10000,
    spentMinor: food + 500, foodSpentMinor: food, eatingOutSpentMinor: 500,
    handLoggedCount: 2, paused, recordedAt: stamp };
}
function add(name, file, description, checks, extra = {}) {
  const path = `valid/${name}.json`;
  writeFileSync(new URL(path, root), JSON.stringify(file, null, 2) + '\n');
  // These independently calculated numbers are verified against the app's real functions in Vitest.
  const balances = Object.fromEntries(file.data.accounts.map((a) => {
    let balance = a.openingMinor;
    for (const e of file.data.entries) {
      if (e.accountId === a.id) balance += e.type === 'income' ? e.amountMinor : -e.amountMinor;
      if (e.type === 'transfer' && e.toAccountId === a.id) balance += e.toAmountMinor;
    }
    return [a.id, balance];
  }));
  const counted = new Set(file.data.plan?.envelopes.map((e) => e.categoryId) ?? []);
  for (const c of CATEGORIES) if (c.kind === 'flexible') counted.add(c.id);
  const start = file.data.plan?.createdOn.startsWith(month) ? file.data.plan.createdOn : `${month}-01`;
  const spent = file.data.entries.filter((e) => e.type === 'expense' && counted.has(e.categoryId) && e.date >= start && e.date.startsWith(month))
    .reduce((sum, e) => sum + e.eurMinor, 0);
  const expected = { balances, accounts: file.data.accounts.length, entries: file.data.entries.length,
    ...(file.data.plan && { leftMinor: file.data.plan.envelopes.reduce((sum, e) => sum + e.monthlyMinor, 0) - spent }), ...extra };
  const accountSummary = file.data.accounts.map((a) => `${a.name}: ${formatMoney(balances[a.id], a.currency)}`).join('; ');
  cases.push({ path, description, checks, expected, accountSummary });
  return file;
}
function reject(name, change, error, source = base()) {
  const file = clone(source);
  change(file);
  const path = `invalid/${name}.json`;
  writeFileSync(new URL(path, root), JSON.stringify(file, null, 2) + '\n');
  cases.push({ path, error });
}

const original = JSON.parse(readFileSync(new URL('../fixtures/studentsbudget-demo-2026-10.json', import.meta.url), 'utf8'));
const offset = (Number(month.slice(0, 4)) - 2026) * 12 + Number(month.slice(5)) - 10;
// Move the original two-month demo, clamping month-end days if necessary.
function moveDates(value) {
  if (Array.isArray(value)) return value.map(moveDates);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, moveDates(v)]));
  if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:$|-\d{2})/.test(value)) return value;
  const m = shiftMonth(value.slice(0, 7), offset);
  if (value.length === 7) return m;
  const last = Number(day(`${shiftMonth(m, 1)}-01`, -1).slice(-2));
  return m + '-' + String(Math.min(Number(value.slice(8, 10)), last)).padStart(2, '0') + value.slice(10);
}
const everyday = moveDates(original);
everyday.version = 3;
everyday.exportedAt = stamp;
Object.assign(everyday.data, { weekResults: [], discountVotes: [], profile: null });
add('01-everyday-student', everyday, 'Realistic two-month demo with 47 entries and three accounts.', [
  'Open Home, Entries, Charts and Settings. Shopping is over budget in the demo month.',
  'Balances: local EUR 1,680.22; home INR 170,050.00; cash EUR 143.00. Combined EUR 3,613.22 at the fictional manual rate INR 95 per EUR.',
  'Dates moved to the demo month, but this file can include purchases later than today. Entries and monthly totals include those dates.',
]);
const clean = base();
const weekMinor = Math.round(clean.data.plan.envelopes.reduce((sum, e) => sum + e.monthlyMinor, 0) / weeksLeft);
add('02-clean-budget', clean, 'Clean starting point for entering expenses, income and transfers.', [
  'Home: EUR 500 left this month. Settings: bank EUR 1,000; cash EUR 100; combined EUR 1,100.',
  `Home on ${ddmmyyyy(today)}: "This week: ${formatMoney(weekMinor, 'EUR', { whole: true })} safe to spend", and "This week: ${formatMoney(weekMinor - 1000, 'EUR', { whole: true })} safe to spend" after EUR 10 of Food. The week figure changes with the date.`,
  'Quick add demo-snack 6, choose Eating out, then demo-snack 4: second entry remembers the category. Undo within 10 seconds removes only the EUR 4 entry.',
  'Quick add defaults to the EUR bank. Edit the EUR 6 entry to EUR 7.50; exactly one entry remains. Cancel a deletion, then confirm it.',
], { weekMinor, weekAfterFoodMinor: weekMinor - 1000 });
const over = base();
for (const [cat, amt] of [['food', 30000], ['eating-out', 12000], ['shopping', 10000], ['transport', 4000]]) entry(over, cat, amt);
add('03-overspent-swaps', over, 'Overspending, negative remaining money and saving suggestions.', [
  'Home: EUR 60 over this month. Food EUR 50 over; Eating out EUR 40 over; Shopping EUR 40 over; Transport EUR 10 over.',
  'Open the Eating out Try this suggestion: sources and saving explanation appear. Check-in also reviews the overspent categories.',
]);
const zero = base();
zero.data.accounts.forEach((a) => a.openingMinor = 0);
zero.data.plan.incomes = []; zero.data.plan.fixed = []; zero.data.plan.envelopes.forEach((e) => e.monthlyMinor = 0); zero.data.plan.spendingBudgetMinor = 0;
add('04-zero-budget', zero, 'All amounts zero; empty charts and no earned badges.', ['Home shows EUR 0, never NaN or Infinity. Charts explain the empty data. Adding EUR 1 spending is allowed and makes the month EUR 1 over.']);
const debt = base();
debt.data.accounts[0].openingMinor = -5000; debt.data.accounts[1].openingMinor = 1000;
entry(debt, 'food', 1500, { accountId: 'cash' });
add('05-overdrawn-accounts', debt, 'Negative balances are valid and distinct from the envelope budget.', ['Settings: bank -EUR 50; cash -EUR 5; combined -EUR 55. Home still has EUR 485 left in envelopes.']);
const fx = base();
for (const [currency, perEur] of [['INR', 95], ['USD', 1.25], ['GBP', 0.8], ['CHF', 1], ['CNY', 8], ['TRY', 40]]) {
  fx.data.accounts.push({ id: currency, name: `Demo ${currency}`, kind: 'bank', currency, openingMinor: Math.round(10000 * perEur), createdAt: stamp });
  fx.data.fxRates.push(rate(currency, perEur));
}
entry(fx, 'study', 95000, { accountId: 'INR', eurMinor: 1000, note: 'Books paid in INR' });
entry(fx, 'food', 1250, { accountId: 'USD', eurMinor: 1000, note: 'Groceries paid in USD' });
add('06-all-currencies', fx, 'All seven supported currencies with stable fictional manual rates.', [
  'Combined balance EUR 1,680; Home EUR 480 left. Both imported foreign expenses count as EUR 10, even after a rate change.',
  'Add INR 950 through the full expense form: EUR 10 spending at INR 95 per EUR. Manual INR 0 is refused; 100 is accepted and affects future conversions and account totals.',
  'Use ECB rate again only after checking the manual case: live market values are deliberately not fixed expectations.',
]);
const missing = base();
missing.data.accounts = [{ ...missing.data.accounts[0], id: 'INR', name: 'INR bank without rate', currency: 'INR', openingMinor: 950000 }];
add('07-missing-exchange-rate', missing, 'Foreign account without any saved rate; test OFFLINE.', [
  'Load/cache the production app first. Go offline before restoring this file so a live rate cannot fill the gap.',
  'The account shows INR 9,500. Combined balance shows a dash and names the missing INR rate. A foreign expense cannot save until a rate exists.',
  'Set a manual INR rate of 95 in Settings. Combined balance becomes EUR 100 and INR 95 spending converts to EUR 1.',
]);
const recurring = base();
recurring.data.plan.incomes[0].schedule = schedule('demo-parents', { amountMinor: 120000 });
recurring.data.plan.incomes.push({ categoryId: 'income-job', monthlyMinor: 21667,
  schedule: schedule('demo-weekly-job', { frequency: 'weekly', day: weekday, startOn: monday, postedThrough: day(monday, -1), amountMinor: 5000 }) });
recurring.data.plan.fixed[0].schedule = schedule('demo-rent');
recurring.data.plan.fixed[1].schedule = schedule('demo-paused-phone', { amountMinor: 2000, paused: true });
add('08-recurring-due-and-paused', recurring, 'Three occurrences due on the generation date; one paused.', [
  'On the demo date, restore then open Entries: Parents EUR 1,200 income, Job EUR 50 income, Rent EUR 450 expense appear with Recurring tags; no Phone entry.',
  'After posting: bank EUR 1,800; cash EUR 100; combined EUR 1,900. Envelope money stays EUR 500.',
  'Reload twice: exactly three entries remain. Settings lets you pause, resume and edit schedules; resuming starts from the next day, without backfilling the pause.',
], { afterPosting: { entries: 3, bankMinor: 180000 } });
const charts = base();
for (let i = -11; i <= 0; i++) {
  const date = `${shiftMonth(month, i)}-01`;
  entry(charts, 'income-parents', 140000, { date, type: 'income' });
  CATEGORIES.filter((c) => c.kind === 'flexible').forEach((c, n) => entry(charts, c.id, (n + 1) * 100, { date }));
  CATEGORIES.filter((c) => c.kind === 'fixed').forEach((c, n) => entry(charts, c.id, (n + 11) * 100, { date }));
  entry(charts, 'one-off', 2500, { date });
  const transfer = entry(charts, '', 2000, { date, type: 'transfer', toAccountId: 'cash', toAmountMinor: 2000, note: 'Demo transfer' });
  delete transfer.categoryId;
}
add('09-twelve-months-all-categories', charts, 'Twelve populated months, every spending category, income and transfers.', [
  'This month spending EUR 201; income EUR 1,400; saved EUR 1,199. Twelve months: spending EUR 2,412; income EUR 16,800; saved EUR 14,388.',
  'Try Donut/Bars/Table, Columns/Line/Table and 1/3/6/12-month ranges. The donut groups small categories into Everything else.',
  'Tap a category or time column to open matching entries. Everything else has no drill-down. Multi-month category drill-down opens the end month.',
  'The EUR 20 monthly transfers move balances without increasing chart income or spending. Check narrow phone layout and keyboard navigation.',
]);
function badgeFile(count) {
  const file = base();
  for (let i = 0; i < count; i++) {
    const end = day(lastSunday, -7 * (count - 1 - i));
    const food = (count - i + 1) * 100;
    const row = savedWeek(end, food);
    file.data.weekResults.push(row);
    entry(file, 'food', food, { date: row.weekStart });
    entry(file, 'eating-out', 500, { date: row.weekStart });
  }
  // Earlier full months establish the Latte Survivor mark and improvement before the weekly history.
  entry(file, 'eating-out', 12000, { date: `${shiftMonth(month, -10)}-01` });
  entry(file, 'eating-out', 4000, { date: `${shiftMonth(month, -9)}-01` });
  return file;
}
for (const [number, count, tier] of [['10', 6, 'bronze'], ['11', 12, 'silver'], ['12', 26, 'gold']]) {
  add(`${number}-badges-${tier}`, badgeFile(count), `${count} recorded under-budget weeks; ${tier} tier and all four badges.`, [
    `Badges: Under-Budget Week ${tier}, Logging Streak earned, Ramen Royalty earned, Latte Survivor earned.`,
    'Saved weeks represent historical EUR 100 weekly allowances; changing today\'s plan does not rewrite those records.',
  ], { badgeTier: tier });
}
const away = badgeFile(6);
away.data.weekResults.at(-1).paused = true;
away.data.weekResults.push({ ...savedWeek(day(monday, 6), 0, true), spentMinor: 0, eatingOutSpentMinor: 0, handLoggedCount: 0, recordedAt: '' });
add('13-away-week', away, 'An earned streak with a recorded away week and a current away mark.', ['Check-in: I was away this week is selected. Badges: streak is paused; away weeks do not count toward Under-Budget Week or grocery records. Toggle off and reload: the current mark stays off.']);
const empty = base();
Object.assign(empty.data, { accounts: [], plan: null, categories: [], entries: [] });
add('14-fresh-setup', empty, 'Accepted empty backup to demonstrate onboarding.', [
  'Restore returns to setup, with no plan or accounts. Complete the wizard on a phone-sized screen.',
  'Try blank/zero amounts, invalid text, Back/Next, city cost sources and suggested envelopes. Save a valid plan; reopening setup should not create a second one.',
]);
const late = base();
late.data.plan.createdOn = today;
entry(late, 'food', 1000, { date: day(today, -1), note: 'Before setup: excluded from envelopes' });
entry(late, 'food', 2000, { note: 'After setup: counted' });
add('15-setup-date-boundary', late, 'Spending before setup affects balances but not the setup month\'s envelopes.', [
  'Home has EUR 480 left. Combined accounts EUR 1,070: both purchases affect balances.',
  'Charts for the demo month count only EUR 20 of grocery spending. On the first of a month, the earlier EUR 10 belongs to the previous month instead.',
  'Check-in lists a pre-setup purchase with an exclusion note when it falls in the displayed week; otherwise find it through Entries.',
]);
const oneoffs = base();
oneoffs.data.plan.oneOffs = [
  { id: 'past', name: 'Already due: no reserve', amountMinor: 10000, createdMonth: shiftMonth(month, -2), dueMonth: shiftMonth(month, -1) },
  { id: 'now', name: 'Due this month: no reserve', amountMinor: 20000, createdMonth: shiftMonth(month, -2), dueMonth: month },
  { id: 'future', name: 'Reserve EUR 50 per month', amountMinor: 30000, createdMonth: month, dueMonth: shiftMonth(month, 6) },
];
add('16-one-off-reserves', oneoffs, 'Past, current and future due months.', ['Edit plan keeps all three costs and remains saveable. Plan summary sets aside EUR 50 this month, leaving EUR 650 available after fixed costs; envelope total remains EUR 500. One-off reserves do not create transactions by themselves.'], { setAsideMinor: 5000, availableMinor: 65000 });
const cents = base();
cents.data.plan.envelopes.forEach((e) => e.monthlyMinor = e.categoryId === 'food' ? 30 : 0);
entry(cents, 'food', 1, { note: 'Café döner ₹ 中文 🎓 <script>alert("demo")</script> ' + 'long receipt text '.repeat(12) });
add('17-cents-unicode-long-text', cents, 'One-cent precision, multilingual text, long notes and literal markup.', ['Home shows EUR 0.29 left, with cents retained. Bank EUR 999.99. Note displays as text, including the script characters; no alert executes. Edit/reload/export/restore preserve the note. Phone view has no sideways scrolling.']);
const cashDefault = base();
delete cashDefault.data.accounts[0].isDefault; cashDefault.data.accounts[1].isDefault = true;
add('18-default-cash-account', cashDefault, 'Explicit default cash overrides the automatic EUR bank choice.', ['Quick add demo-default 6 and choose a category. Cash becomes EUR 94; bank stays EUR 1,000. Set bank as default in Settings and add demo-default 4: bank becomes EUR 996; cash stays EUR 94.']);
const profile = base();
profile.data.profile = { id: 'current', name: 'Alex Demo', university: 'ur', semesterStart: `${month}-01`, semesterEnd: day(`${shiftMonth(month, 6)}-01`, -1), updatedAt: stamp };
profile.data.discountVotes = [{ discountId: DISCOUNTS[0].id, vote: 'works', on: today }, { discountId: DISCOUNTS[1].id, vote: 'outdated', on: today }];
add('19-profile-discount-feedback', profile, 'Profile, semester dates and saved feedback on real catalog IDs.', [
  'Home greets Alex Demo. Settings contains the university and both semester dates. Change the name, save and reload.',
  `Tips > Discounts: ${DISCOUNTS[0].place} is marked Still works; ${DISCOUNTS[1].place} is marked as no longer working and sorted behind working offers. Change feedback, filter a category and reload.`,
  'Semester dates allow a next-semester-fee offer in Edit plan. A published amount depends on the bundled semester catalog; do not expect a quote for every future semester.',
  'Profile form refuses reversed or partially filled semester dates. Clear both dates to save without a semester.',
]);
const exhausted = base();
for (const envelope of exhausted.data.plan.envelopes) entry(exhausted, envelope.categoryId, envelope.monthlyMinor);
add('20-exactly-exhausted', exhausted, 'Every nonzero envelope is spent exactly to its limit.', ['Home: EUR 0 left this month, with no negative-zero display. Add EUR 0.01 Food spending: the month becomes EUR 0.01 over.']);
const impossible = base();
impossible.data.plan.incomes[0].monthlyMinor = 10000;
add('21-income-below-fixed-costs', impossible, 'A plan with EUR 100 income, EUR 500 fixed and EUR 500 envelopes.', ['The plan still restores and can be edited. Suggested budget explains that nothing is available and suggests EUR 0 everywhere, so Use this budget is disabled. Type an amount into one envelope, then press Use this budget: only the envelopes change; income, fixed costs, account balances and entries stay as they were.'], { availableMinor: -40000 });
for (const version of [1, 2]) {
  const legacy = base(); legacy.version = version; legacy.data.categories = [];
  for (const key of ['weekResults', 'discountVotes', 'profile']) delete legacy.data[key];
  if (version === 2) legacy.data.plan.fixed[0].schedule = schedule('legacy-paused', { paused: true });
  add(`2${version + 1}-legacy-version-${version}`, legacy, `Version ${version} compatibility and missing built-in categories.`, ['Restore succeeds; the app supplies all 26 built-in categories. Profile and votes are empty. Export produces a current version 3 backup.']);
}
const extras = base(); extras.futureField = 'ignored'; extras.data.accounts[0].color = 'purple';
add('24-unknown-extra-fields', extras, 'Unknown object fields are ignored for forward-compatible additions.', ['Restore succeeds with the same values as 02-clean-budget. Export does not retain unknown fields.']);

// Deliberately corrupt one thing at a time so the expected refusal is unambiguous.
const notBackup = "This isn't a StudentsBudget backup file.";
const incomplete = 'This backup file is incomplete.';
const damaged = (reason) => `This backup file is damaged: ${reason}.`;
reject('wrong-app', (f) => f.app = 'another-app', notBackup);
reject('newer-version', (f) => f.version = 4, 'This backup is from a newer version of the app.');
for (const [key, name] of [['version', 'version'], ['exportedAt', 'exported-at'], ['data', 'data']]) reject(`missing-${name}`, (f) => delete f[key], incomplete);
for (const [key, name] of [['accounts', 'accounts'], ['categories', 'categories'], ['entries', 'entries'], ['plan', 'plan'], ['guesses', 'guesses'], ['fxRates', 'fx-rates']]) reject(`missing-data-${name}`, (f) => delete f.data[key], incomplete);
reject('unsupported-version-zero', (f) => f.version = 0, incomplete);
reject('version-is-text', (f) => f.version = '3', incomplete);
reject('bad-export-timestamp', (f) => f.exportedAt = 'yesterday', incomplete);
reject('unknown-currency', (f) => f.data.accounts[0].currency = 'XYZ', incomplete);
reject('unknown-city', (f) => f.data.plan.cityId = 'berlin', incomplete);
reject('rate-zero', (f) => f.data.fxRates.push(rate('INR', 0)), incomplete);
reject('rate-negative', (f) => f.data.fxRates.push(rate('INR', -95)), incomplete);
const withEntry = base(); entry(withEntry, 'food', 1000);
for (const date of ['2026-02-30', '21/10/2026']) reject(`bad-entry-date-${date.replaceAll('/', '-')}`, (f) => f.data.entries[0].date = date, incomplete, withEntry);
reject('fractional-minor-units', (f) => f.data.entries[0].amountMinor = 1.5, incomplete, withEntry);
reject('amount-is-text', (f) => f.data.entries[0].amountMinor = '1000', incomplete, withEntry);
reject('entry-zero', (f) => f.data.entries[0].amountMinor = 0, damaged('an amount is zero or negative'), withEntry);
reject('entry-negative', (f) => f.data.entries[0].amountMinor = -1, damaged('an amount is zero or negative'), withEntry);
reject('entry-negative-euros', (f) => f.data.entries[0].eurMinor = -1, damaged('an amount is negative'), withEntry);
reject('missing-entry-account', (f) => f.data.entries[0].accountId = 'ghost', damaged("an entry uses an account that isn't in the file"), withEntry);
reject('missing-entry-category', (f) => f.data.entries[0].categoryId = 'ghost', damaged("an entry uses a category that isn't in the file"), withEntry);
reject('unknown-plan-category', (f) => f.data.plan.envelopes[0].categoryId = 'ghost', damaged('the plan or the guesses use an unknown category'));
reject('negative-envelope', (f) => f.data.plan.envelopes[0].monthlyMinor = -1, damaged('an amount is negative'));
reject('negative-spending-budget', (f) => f.data.plan.spendingBudgetMinor = -1, damaged('an amount is negative'));
const transferFile = base();
const transfer = entry(transferFile, '', 1000, { type: 'transfer', toAccountId: 'cash', toAmountMinor: 1000, note: 'Demo transfer' }); delete transfer.categoryId;
reject('missing-transfer-target', (f) => f.data.entries[0].toAccountId = 'ghost', damaged("a transfer goes to an account that isn't in the file"), transferFile);
reject('transfer-without-target-field', (f) => delete f.data.entries[0].toAccountId, incomplete, transferFile);
reject('transfer-received-zero', (f) => f.data.entries[0].toAmountMinor = 0, damaged('an amount is zero or negative'), transferFile);
for (const [table, name] of [['accounts', 'accounts'], ['categories', 'categories'], ['entries', 'entries'], ['guesses', 'guesses'], ['fxRates', 'fx-rates'], ['weekResults', 'week-results'], ['discountVotes', 'discount-votes']]) {
  const source = clone(withEntry);
  source.data.guesses = [{ categoryId: 'food', monthlyMinor: 100, guessedOn: today }];
  source.data.fxRates = [rate('INR', 95)]; source.data.weekResults = [savedWeek(lastSunday)];
  source.data.discountVotes = [{ discountId: DISCOUNTS[0].id, vote: 'works', on: today }];
  reject(`duplicate-${name}`, (f) => f.data[table].push(clone(f.data[table][0])), damaged('two rows share the same id'), source);
}
reject('duplicate-one-offs', (f) => f.data.plan.oneOffs.push(clone(f.data.plan.oneOffs[0])), damaged('two rows share the same id'), oneoffs);
reject('duplicate-schedules', (f) => f.data.plan.fixed[0].schedule.id = f.data.plan.incomes[0].schedule.id, damaged('two rows share the same id'), recurring);
reject('schedule-missing-account', (f) => f.data.plan.fixed[0].schedule.accountId = 'ghost', damaged("a fixed cost or income uses an account that isn't in the file"), recurring);
reject('schedule-day-32', (f) => f.data.plan.fixed[0].schedule.day = 32, damaged('a fixed cost or income has an impossible schedule'), recurring);
reject('schedule-weekday-8', (f) => f.data.plan.incomes[1].schedule.day = 8, damaged('a fixed cost or income has an impossible schedule'), recurring);
reject('schedule-watermark-before-start', (f) => f.data.plan.fixed[0].schedule.postedThrough = day(`${month}-01`, -2), damaged('a fixed cost or income has an impossible schedule'), recurring);
reject('schedule-before-plan-start', (f) => f.data.plan.fixed[0].schedule.startOn = day(f.data.plan.createdOn, -1), damaged('a fixed cost or income has an impossible schedule'), recurring);
reject('schedule-frequency-daily', (f) => f.data.plan.fixed[0].schedule.frequency = 'daily', incomplete, recurring);
reject('week-start-not-monday', (f) => { const w = savedWeek(lastSunday); w.weekStart = day(w.weekStart, 1); f.data.weekResults = [w]; }, damaged("a saved week doesn't run from Monday to Sunday"));
reject('week-end-not-sunday', (f) => { const w = savedWeek(lastSunday); w.weekEnd = day(w.weekEnd, -1); f.data.weekResults = [w]; }, damaged("a saved week doesn't run from Monday to Sunday"));
reject('negative-week-amount', (f) => { const w = savedWeek(lastSunday); w.spentMinor = -1; f.data.weekResults = [w]; }, damaged('an amount is negative'));
reject('negative-log-count', (f) => { const w = savedWeek(lastSunday); w.handLoggedCount = -1; f.data.weekResults = [w]; }, incomplete);
reject('unknown-discount-vote', (f) => f.data.discountVotes = [{ discountId: DISCOUNTS[0].id, vote: 'maybe', on: today }], incomplete);
reject('unknown-university', (f) => f.data.profile.university = 'unknown', incomplete, profile);
reject('invalid-semester-date', (f) => f.data.profile.semesterStart = '2026-02-30', incomplete, profile);
reject('one-off-zero', (f) => f.data.plan.oneOffs[0].amountMinor = 0, damaged('an amount is zero or negative'), oneoffs);
reject('one-off-invalid-month', (f) => f.data.plan.oneOffs[0].dueMonth = '2026-13', incomplete, oneoffs);
const malformedPath = 'invalid/malformed-json.json';
writeFileSync(new URL(malformedPath, root), '{ "app": "studentsbudget", "version": 3, BROKEN JSON\n');
cases.push({ path: malformedPath, error: notBackup });
writeFileSync(new URL('manifest.json', root), JSON.stringify({ generatedFor: today, month, cases }, null, 2) + '\n');
const valid = cases.filter((c) => !c.error);
const invalid = cases.filter((c) => c.error);
const inventory = [
  '# Upload file inventory', '', `Generated for **${ddmmyyyy(today)}**, demo month **${monthLabel(month)}**. Dates inside the files and the figures below follow that day; the guide says how long each stays valid.`, '',
  `Read ${existsSync(new URL('README.md', root)) ? '[the manual test guide](README.md)' : 'the manual test guide (fixtures/manual-demo/README.md)'} first. Only files in valid/ and invalid/ are app imports; manifest.json is verification metadata.`, '',
  '## Accepted files', '',
  ...valid.flatMap((c) => [`### [${c.path.split('/')[1]}](${c.path})`, '', c.description, '',
    `Before automatic processing: **${c.expected.accounts} ${c.expected.accounts === 1 ? 'account' : 'accounts'} · ${c.expected.entries} ${c.expected.entries === 1 ? 'entry' : 'entries'}**` + (c.expected.leftMinor !== undefined ? ` · envelope remainder ${formatMoney(c.expected.leftMinor, 'EUR')}.` : '.'), '',
    ...(c.accountSummary ? [`Account balances: ${c.accountSummary}.`, ''] : []),
    ...c.checks.map((check) => `- [ ] ${check}`), '']),
  '## Rejected files', '', 'For each file: restore 02-clean-budget first, choose the invalid file, check the exact message below, and reload. No replacement confirmation should appear; bank EUR 1,000, cash EUR 100 and zero entries must remain unchanged.', '',
  '| File | Expected message |', '|---|---|', ...invalid.map((c) => `| [${c.path.split('/')[1]}](${c.path}) | ${c.error} |`), '',
];
writeFileSync(new URL('CASES.md', root), inventory.join('\n'));
console.log(`Generated ${valid.length} accepted and ${invalid.length} rejected fixtures for ${today} in ${fileURLToPath(root)}`);
