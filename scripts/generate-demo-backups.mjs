import { mkdirSync, writeFileSync } from 'node:fs';
import { CATEGORIES, GUESS_CATEGORY_IDS } from '../src/data/categories.ts';

// Run with Node 24: node scripts/generate-demo-backups.mjs [YYYY-MM-DD].
const today = process.argv[2] ?? new Intl.DateTimeFormat('en-CA').format(new Date());
const anchor = new Date(`${today}T12:00:00Z`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== today) {
  throw new Error('Use a real date in YYYY-MM-DD format.');
}
const month = today.slice(0, 7);
const monthAt = (offset) => new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
const stamp = (date) => `${date}T10:00:00.000Z`;
const before = (date) => new Date(new Date(`${date}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
const root = new URL('../fixtures/scenarios/', import.meta.url);
mkdirSync(root, { recursive: true });
mkdirSync(new URL('invalid/', root), { recursive: true });
const flexible = CATEGORIES.filter((c) => c.kind === 'flexible');
const fixed = CATEGORIES.filter((c) => c.kind === 'fixed');
const incomes = CATEGORIES.filter((c) => c.kind === 'income');
const bank = (id = 'bank', currency = 'EUR', openingMinor = 200000) => ({ id, name: `Demo ${currency} ${id}`, kind: id === 'cash' ? 'cash' : 'bank', currency, openingMinor, createdAt: stamp(`${monthAt(-11)}-01`) });
function base(createdOn = `${monthAt(-11)}-01`) {
  return { app: 'studentsbudget', version: 2, exportedAt: stamp(today), data: {
    accounts: [bank(), bank('cash', 'EUR', 10000)], categories: structuredClone(CATEGORIES), entries: [],
    plan: { id: 'current', cityId: 'regensburg', createdOn,
      incomes: incomes.map((c, i) => ({ categoryId: c.id, monthlyMinor: [60000, 70000, 20000, 10000, 15000, 5000][i] })),
      fixed: fixed.map((c, i) => ({ categoryId: c.id, monthlyMinor: [45000, 1500, 12500, 999, 4300, 2500, 5000][i] })),
      envelopes: flexible.map((c, i) => ({ categoryId: c.id, monthlyMinor: i === 0 ? 24000 : 3000 })),
      oneOffs: [{ id: 'semester', name: 'Next semester fee', amountMinor: 30000, createdMonth: month, dueMonth: monthAt(5) },
        { id: 'deposit', name: 'Past accommodation deposit', amountMinor: 50000, createdMonth: monthAt(-11), dueMonth: monthAt(-10) }],
    }, guesses: GUESS_CATEGORY_IDS.map((categoryId) => ({ categoryId, monthlyMinor: 6000, guessedOn: createdOn })), fxRates: [],
  } };
}
function entry(file, date, type, categoryId, amountMinor, note, accountId = 'bank', eurMinor = amountMinor) {
  const row = { id: `demo-${String(file.data.entries.length + 1).padStart(4, '0')}`, date, type, categoryId, accountId, amountMinor, eurMinor, note, createdAt: stamp(date) };
  file.data.entries.push(row);
  return row;
}
function transfer(file, date, accountId, toAccountId, amountMinor, toAmountMinor, eurMinor) {
  file.data.entries.push({ id: `transfer-${file.data.entries.length}`, date, type: 'transfer', accountId, toAccountId, amountMinor, toAmountMinor, eurMinor, note: 'Demo transfer (excluded from spending)', createdAt: stamp(date) });
}
const write = (name, file) => {
  writeFileSync(new URL(name, root), `${JSON.stringify(file, null, 2)}\n`);
  console.log(`${name}: ${file.data.accounts.length} accounts, ${file.data.entries.length} entries`);
};

const history = base();
for (let offset = -11; offset <= 0; offset++) {
  const m = monthAt(offset);
  for (const line of history.data.plan.incomes) entry(history, `${m}-01`, 'income', line.categoryId, line.monthlyMinor, `Demo ${line.categoryId}`);
  for (const line of history.data.plan.fixed) entry(history, `${m}-01`, 'expense', line.categoryId, line.monthlyMinor, `Demo ${line.categoryId}`);
  for (const day of [3, 10, 17, 24]) {
    if (`${m}-${String(day).padStart(2, '0')}` > today) continue;
    for (const [i, c] of flexible.entries()) entry(history, `${m}-${String(day).padStart(2, '0')}`, 'expense', c.id,
      i === 0 ? 3200 + (offset + 11) * 100 : 200 + i * 50 + (offset + 11) * 15,
      c.id === 'food' ? 'Groceries — Gemüse, rice & café ☕' : `Demo ${c.name}`, i % 3 === 0 ? 'cash' : 'bank');
  }
  if (`${m}-02` <= today) {
    entry(history, `${m}-02`, 'expense', 'one-off', 2500, 'University equipment (one-off)');
    transfer(history, `${m}-02`, 'bank', 'cash', 30000, 30000, 30000);
  }
}
write('01-everyday-and-12-month-history.json', history);

const over = base(`${month}-01`);
over.data.accounts = [bank('bank', 'EUR', -5000), bank('cash', 'EUR', 0)];
over.data.plan.incomes = [{ categoryId: 'income-job', monthlyMinor: 70000 }];
over.data.plan.envelopes = flexible.map((c) => ({ categoryId: c.id, monthlyMinor: c.id === 'other' ? 0 : 1000 }));
entry(over, today, 'expense', 'food', 45000, 'Food envelope far over budget');
entry(over, today, 'expense', 'shopping', 60000, 'Laptop replacement');
entry(over, today, 'expense', 'other', 2500, 'Spending in a zero-budget category');
entry(over, today, 'expense', 'health', 1, 'One-cent rounding check');
write('02-overspent-and-overdrawn.json', over);

const fresh = base(today);
fresh.data.plan.envelopes.find((c) => c.categoryId === 'travel').monthlyMinor = 0;
fresh.data.plan.oneOffs = [{ id: 'move-in', name: 'Move-in equipment', amountMinor: 20000, createdMonth: month, dueMonth: month }];
entry(fresh, before(today), 'expense', 'food', 1800, 'Before setup: excluded from flexible budget');
entry(fresh, before(today), 'expense', 'rent', 45000, 'Rent before setup: still counts as fixed');
entry(fresh, today, 'expense', 'food', 650, 'First lunch after setup');
entry(fresh, today, 'expense', 'travel', 1200, 'Travel with no envelope');
write('03-new-student-mid-month.json', fresh);

const fx = base(`${month}-01`);
const rates = { EUR: 1, INR: 95, USD: 1.1, GBP: 0.85, CHF: 0.95, CNY: 7.8, TRY: 38 };
fx.data.accounts = Object.entries(rates).map(([currency, rate]) => bank(currency.toLowerCase(), currency, Math.round(100000 * rate)));
for (const [currency, perEur] of Object.entries(rates)) {
  if (currency !== 'EUR') {
    fx.data.fxRates.push({ currency, perEur, source: 'manual', rateDate: today, fetchedOn: today });
    fx.data.fxRates.push({ currency, perEur: perEur * 1.02, source: 'ecb', rateDate: before(today), fetchedOn: today });
  }
  entry(fx, today, 'expense', 'food', Math.round(1000 * perEur), `Groceries paid in ${currency}`, currency.toLowerCase(), 1000);
}
transfer(fx, today, 'eur', 'usd', 10000, 11000, 10000);
transfer(fx, today, 'inr', 'eur', 950000, 10000, 10000);
write('04-all-currencies-and-transfers.json', fx);
const missing = structuredClone(fx);
missing.data.fxRates = missing.data.fxRates.filter((r) => r.currency !== 'TRY');
write('05-missing-exchange-rate.json', missing);

const recurring = base(`${month}-01`);
const schedule = (id, amountMinor, frequency = 'monthly', day = 1, extra = {}) => ({ id, frequency, day, accountId: 'bank', amountMinor, startOn: `${month}-01`, postedThrough: before(`${month}-01`), ...extra });
recurring.data.accounts.push(bank('chf', 'CHF', 100000));
recurring.data.plan.incomes = [
  { categoryId: 'income-job', monthlyMinor: 65000, schedule: schedule('weekly-job', 15000, 'weekly', 1) },
  { categoryId: 'income-parents', monthlyMinor: 70000, schedule: schedule('monthly-parents', 70000) },
  { categoryId: 'income-scholarship', monthlyMinor: 20000, schedule: schedule('blocked-chf', 19000, 'monthly', 1, { accountId: 'chf' }) },
];
recurring.data.plan.fixed = [
  { categoryId: 'rent', monthlyMinor: 45000, schedule: schedule('monthly-rent', 45000) },
  { categoryId: 'insurance', monthlyMinor: 12500, schedule: schedule('paused-insurance', 12500, 'monthly', 1, { paused: true }) },
  { categoryId: 'phone', monthlyMinor: 1500, schedule: schedule('month-end-phone', 1500, 'monthly', 31) },
];
entry(recurring, today, 'expense', 'food', 750, 'Manual entry beside automatic bills');
write('06-recurring-due-paused-and-blocked.json', recurring);

const empty = base(today);
empty.data.entries = [];
write('07-plan-with-no-transactions.json', empty);
const setup = base(today);
setup.data.accounts = []; setup.data.plan = null; setup.data.guesses = [];
write('08-empty-start-over.json', setup);

const damaged = structuredClone(fresh);
damaged.data.entries[0].accountId = 'does-not-exist';
write('invalid/01-missing-account.json', damaged);
const newer = structuredClone(fresh); newer.version = 999;
write('invalid/02-newer-version.json', newer);
const duplicate = structuredClone(fresh); duplicate.data.entries.push(structuredClone(duplicate.data.entries[0]));
write('invalid/03-duplicate-entry.json', duplicate);
