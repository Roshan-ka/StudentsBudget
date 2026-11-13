// The random clicker's engine (testkit/README.md, "Random clicker"): a seeded walk through a running app, no AI. It
// picks a visible link, button, tab, switch, field or list at random, acts on it, and logs the step, so a walk that
// found something can be walked again exactly from its log, even when the seed alone would branch differently on a
// slower server. What it must never press and what the console may say come from the app's adapter.

const ROLES = ['link', 'button', 'tab', 'checkbox', 'switch', 'textbox', 'combobox'];
const WORDS = ['coffee', 'rent', 'Mensa', 'books', 'bus', 'gym', 'phone', 'shoes', 'gift', 'snacks'];

/** A seeded random number generator (mulberry32): the same seed gives the same walk on the same pages. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One of the items, picked by the generator. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

/** A value for a field: a word, a number, an amount, an email or nothing, as a person might type. */
export function fieldValue(random) {
  const kind = Math.floor(random() * 6);
  if (kind === 0) return pick(random, WORDS);
  if (kind === 1) return String(Math.floor(random() * 1000));
  if (kind === 2) return `${Math.floor(random() * 200)},${String(Math.floor(random() * 100)).padStart(2, '0')}`;
  if (kind === 3) return `walker${Math.floor(random() * 1000)}@example.com`;
  if (kind === 4) return '';
  return `${pick(random, WORDS)} ${pick(random, WORDS)}`;
}

/**
 * Whether a control may be used: its name matches none of `neverClick` (strings, case-insensitive, or patterns), and
 * a link stays on the app's own origin and opens no new window or download.
 * @param {{ role: string, name?: string, href?: string, target?: string, download?: boolean }} control
 * @param {{ neverClick?: (string | RegExp)[], origin: string }} options
 */
export function mayUse(control, { neverClick = [], origin }) {
  const name = control.name ?? '';
  const refused = neverClick.some((rule) => (rule instanceof RegExp ? rule.test(name) : name.toLowerCase().includes(String(rule).toLowerCase())));
  if (refused) return false;
  if (control.role !== 'link') return true;
  if (control.download || control.target === '_blank') return false;
  if (!control.href) return true;
  try {
    return new URL(control.href, origin).origin === origin;
  } catch {
    return false;
  }
}

/** The visible controls of the page, each as `{ role, name, nth, href?, target?, download?, options? }`. */
export async function controls(page) {
  const found = [];
  for (const role of ROLES) {
    const all = await page.getByRole(role).all();
    const seen = new Map();
    for (const locator of all) {
      if (!(await locator.isVisible().catch(() => false))) continue;
      const facts = await locator
        .evaluate((el) => {
          const labelled = el.getAttribute('aria-labelledby');
          const byId = labelled ? labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ') : '';
          const name = (el.getAttribute('aria-label') || byId || el.labels?.[0]?.textContent || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
          return {
            name,
            href: el.getAttribute('href') ?? undefined,
            target: el.getAttribute('target') ?? undefined,
            download: el.hasAttribute('download') || undefined,
            disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
            options: el.tagName === 'SELECT' ? el.options.length : undefined,
          };
        })
        .catch(() => null);
      if (!facts || facts.disabled) continue;
      const key = `${role}|${facts.name}`;
      const nth = seen.get(key) ?? 0;
      seen.set(key, nth + 1);
      found.push({ role, nth, ...facts });
    }
  }
  return found;
}

/** The page's origin, or null for a page that has none to give (a stand-in in a unit test). */
function originOf(page) {
  try {
    return new URL(page.url()).origin;
  } catch {
    return null;
  }
}

/** The locator a logged step names: the nth control of its role with that name. */
function locate(page, step) {
  return page.getByRole(step.role, step.name ? { name: step.name, exact: true } : undefined).nth(step.nth ?? 0);
}

/** Does one step on the page. A control that moved or went meanwhile isn't a finding: the step is noted as missed. */
async function perform(page, step) {
  try {
    if (step.action === 'back') await page.goBack({ timeout: 5_000 });
    else if (step.action === 'goto') await page.goto(step.to, { timeout: 10_000 });
    else if (step.action === 'reload') await page.reload({ timeout: 10_000 });
    else if (step.action === 'fill') await locate(page, step).fill(step.value ?? '', { timeout: 2_000 });
    else if (step.action === 'select') await locate(page, step).selectOption({ index: step.value ?? 0 }, { timeout: 2_000 });
    else await locate(page, step).click({ timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * A seeded walk until `until` (a time) or `steps` steps: each step a control picked at random among those `mayUse`
 * allows, now and then back or a reload. A step that leaves the app (back past its first page, to about:blank) is
 * followed by a step back to the page the walk started on (`goto`), logged like any other so a replay does the same.
 * `afterStep(step)` runs after each (a watcher's check, say). Returns the log: every step as it was done,
 * `missed: true` where its control was gone by then.
 * @param {any} page a Playwright page
 * @param {{ seed: number, until?: number, steps?: number, neverClick?: (string | RegExp)[], afterStep?: (step: any) => Promise<void> }} options
 */
export async function walk(page, { seed, until, steps = Infinity, neverClick = [], afterStep = async () => {} }) {
  const random = seededRandom(seed);
  const start = page.url();
  const origin = new URL(start).origin;
  const log = [];
  const done = async (n, step, ok) => {
    const entry = { n, ...step, url: new URL(page.url()).pathname, ...(ok ? {} : { missed: true }) };
    log.push(entry);
    await afterStep(entry);
  };
  for (let n = 0; n < steps && (until === undefined || Date.now() < until); n += 1) {
    const roll = random();
    let step;
    if (roll < 0.04) step = { action: 'back' };
    else if (roll < 0.06) step = { action: 'reload' };
    else {
      const usable = (await controls(page)).filter((c) => mayUse(c, { neverClick, origin }));
      if (usable.length === 0) step = { action: 'back' };
      else {
        const control = pick(random, usable);
        const { role, name, nth } = control;
        if (role === 'textbox') step = { action: 'fill', role, name, nth, value: fieldValue(random) };
        else if (role === 'combobox' && control.options) step = { action: 'select', role, name, nth, value: Math.floor(random() * control.options) };
        else step = { action: 'click', role, name, nth };
      }
    }
    await done(n, step, await perform(page, step));
    if (originOf(page) !== origin && n + 1 < steps) {
      n += 1;
      const home = { action: 'goto', to: start };
      await done(n, home, await perform(page, home));
    }
  }
  return log;
}

/**
 * Walks a logged walk again, step for step, with the same `afterStep`. Returns the new log.
 * @param {any} page a Playwright page
 * @param {any[]} steps a log from `walk` (or `readLog`)
 * @param {{ afterStep?: (step: any) => Promise<void> }} [options]
 */
export async function replay(page, steps, { afterStep = async () => {} } = {}) {
  const log = [];
  for (const step of steps) {
    // The step as it was asked for: its number, where it ended and whether it missed come from this walk.
    const action = Object.fromEntries(Object.entries(step).filter(([key]) => !['n', 'url', 'missed'].includes(key)));
    const done = await perform(page, action);
    const entry = { n: step.n, ...action, url: new URL(page.url()).pathname, ...(done ? {} : { missed: true }) };
    log.push(entry);
    await afterStep(entry);
  }
  return log;
}

/** The log as JSON lines, and back. */
export const logText = (log) => log.map((entry) => JSON.stringify(entry)).join('\n') + '\n';
export const readLog = (text) => text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

/**
 * Watches a page for what a walk must never meet: an uncaught page error, a console error that isn't on
 * `consoleAllow`, a response of 500 or more, or a `forbidden` locator becoming visible (admin content for someone who
 * isn't one). Errors while the page is off the app's origin (about:blank after going back past the first page) aren't
 * the app's and don't count. Returns `problems` (each with the step it came after) and `check(step)`, for walk's
 * `afterStep`.
 * @param {any} page a Playwright page
 * @param {{ consoleAllow?: (string | RegExp)[], forbidden?: { what: string, locator: { isVisible(): Promise<boolean> } }[] }} [options]
 * @returns {{ problems: string[], check(step: any): Promise<void> }}
 */
export function watch(page, { consoleAllow = [], forbidden = [] } = {}) {
  const problems = [];
  let at = 'before the first step';
  const origin = originOf(page);
  const onApp = () => origin === null || originOf(page) === origin;
  const allowed = (text) => consoleAllow.some((rule) => (rule instanceof RegExp ? rule.test(text) : text.includes(rule)));
  page.on('pageerror', (error) => {
    if (onApp()) problems.push(`${at}: page error: ${String(error.message).split('\n')[0]}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && onApp() && !allowed(message.text())) problems.push(`${at}: console error: ${message.text().split('\n')[0].slice(0, 200)}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${at}: ${response.status()} from ${new URL(response.url()).pathname}`);
  });
  return {
    problems,
    async check(step) {
      at = `after step ${step.n} (${step.action}${step.name ? ` "${step.name}"` : ''} on ${step.url})`;
      for (const { what, locator } of forbidden) {
        if (await locator.isVisible().catch(() => false)) problems.push(`${at}: ${what} is shown`);
      }
    },
  };
}
