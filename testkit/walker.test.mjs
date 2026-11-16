import { describe, expect, it } from 'vitest';
import { controls, fieldValue, logText, mayUse, pick, readLog, seededRandom, walk, watch } from './walker.mjs';

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, and others for another', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRandom(43)()).not.toBe(first[0]);
  });

  it('picks and fills the same way for the same seed', () => {
    const run = (seed) => {
      const random = seededRandom(seed);
      return [pick(random, ['a', 'b', 'c']), fieldValue(random), fieldValue(random)];
    };
    expect(run(7)).toEqual(run(7));
  });
});

describe('mayUse', () => {
  const origin = 'http://localhost:3210';
  const never = ['Delete my account', /^sign out$/i];

  it('refuses a control on the never-click list, by text or pattern', () => {
    expect(mayUse({ role: 'button', name: 'Delete my account' }, { neverClick: never, origin })).toBe(false);
    expect(mayUse({ role: 'button', name: 'Sign out' }, { neverClick: never, origin })).toBe(false);
    expect(mayUse({ role: 'button', name: 'Sign out of the demo' }, { neverClick: never, origin })).toBe(true);
    expect(mayUse({ role: 'button', name: 'Save' }, { neverClick: never, origin })).toBe(true);
  });

  it('keeps links on the app: no other origin, new window or download', () => {
    expect(mayUse({ role: 'link', name: 'Tips', href: '/tips' }, { origin })).toBe(true);
    expect(mayUse({ role: 'link', name: 'Source', href: 'https://example.com/' }, { origin })).toBe(false);
    expect(mayUse({ role: 'link', name: 'Help', href: '/help', target: '_blank' }, { origin })).toBe(false);
    expect(mayUse({ role: 'link', name: 'Backup', href: '/x.json', download: true }, { origin })).toBe(false);
  });
});

describe('the step log', () => {
  it('goes to JSON lines and back unchanged', () => {
    const log = [{ n: 0, action: 'click', role: 'link', name: 'Tips', nth: 0, url: '/' }, { n: 1, action: 'back', url: '/tips', missed: true }];
    expect(readLog(logText(log))).toEqual(log);
  });
});

describe('watch', () => {
  /** A page that fires the events a test hands it. */
  function fakePage() {
    const handlers = {};
    return {
      on: (event, handler) => (handlers[event] = handler),
      fire: (event, payload) => handlers[event](payload),
    };
  }

  it('names a page error, an unexpected console error and a 5xx, each with the step before it', async () => {
    const page = fakePage();
    const watcher = watch(page, { consoleAllow: [/status of 40\d/] });
    page.fire('pageerror', new Error('boom\nstack'));
    await watcher.check({ n: 3, action: 'click', name: 'Save', url: '/plan' });
    page.fire('console', { type: () => 'error', text: () => 'Failed to load resource: the server responded with a status of 403' });
    page.fire('console', { type: () => 'error', text: () => 'TypeError: x is undefined' });
    page.fire('console', { type: () => 'warning', text: () => 'just a warning' });
    page.fire('response', { status: () => 502, url: () => 'http://localhost:3210/api/sync?x=1' });
    expect(watcher.problems).toEqual([
      'before the first step: page error: boom',
      'after step 3 (click "Save" on /plan): console error: TypeError: x is undefined',
      'after step 3 (click "Save" on /plan): 502 from /api/sync',
    ]);
  });

  it('leaves out errors while the page is off the app, such as about:blank after going back too far', async () => {
    const page = { ...fakePage(), where: 'http://localhost:3210/plan' };
    page.url = () => page.where;
    const watcher = watch(page, {});
    page.where = 'about:blank';
    page.fire('pageerror', new Error("Failed to read the 'localStorage' property from 'Window'"));
    page.where = 'http://localhost:3210/plan';
    page.fire('pageerror', new Error('boom'));
    expect(watcher.problems).toEqual(['before the first step: page error: boom']);
  });

  it('names forbidden content that became visible', async () => {
    const page = fakePage();
    const watcher = watch(page, { forbidden: [{ what: 'the reported posts', locator: { isVisible: async () => true } }] });
    await watcher.check({ n: 0, action: 'click', name: 'Admin', url: '/settings' });
    expect(watcher.problems).toEqual(['after step 0 (click "Admin" on /settings): the reported posts is shown']);
  });
});

describe('walk', () => {
  it('goes back to where it started when a step leaves the app, and logs that step too', async () => {
    const start = 'http://localhost:3210/plan';
    let where = start;
    // A page with nothing to press: every step is back or a reload, and back leaves the app.
    const page = {
      url: () => where,
      goBack: async () => (where = 'about:blank'),
      reload: async () => {},
      goto: async (to) => (where = to),
      getByRole: () => ({ all: async () => [] }),
    };
    const log = await walk(page, { seed: 3, steps: 6 });
    expect(log.map((step) => step.n)).toEqual([0, 1, 2, 3, 4, 5]);
    const left = log.filter((step) => step.url === 'blank');
    expect(left.length).toBeGreaterThan(0);
    for (const step of left) expect(log[step.n + 1] ?? { action: 'goto' }).toMatchObject({ action: 'goto', to: start });
    expect(log.filter((step) => step.action === 'goto').every((step) => step.url === '/plan')).toBe(true);
  });
});

describe('a step that hangs', () => {
  it('ends the walk, logged as hung with its time, and the watcher reports it', async () => {
    // A page whose controls never come: reading them hangs.
    const page = { url: () => 'http://localhost:3210/plan', on: () => {}, getByRole: () => ({ all: () => new Promise(() => {}) }) };
    const watcher = watch(page, {});
    const log = await walk(page, { seed: 1, steps: 10, stepLimit: 50, afterStep: watcher.check });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ n: 0, action: 'look', hung: true, missed: true, url: '/plan' });
    expect(log[0].ms).toBeGreaterThanOrEqual(45);
    expect(watcher.problems).toEqual(['step 0 (look on /plan) didn\'t finish in 0 s']);
  });

  it('logs how long each step took', async () => {
    const page = { url: () => 'http://localhost:3210/plan', goBack: async () => {}, reload: async () => {}, getByRole: () => ({ all: async () => [] }) };
    const log = await walk(page, { seed: 2, steps: 3 });
    expect(log.every((step) => Number.isInteger(step.ms) && step.ms >= 0)).toBe(true);
  });
});

describe('controls', () => {
  it('skips a control that went between the count and its look, instead of waiting for it', async () => {
    const looks = [];
    const control = (facts, gone = false) => ({
      isVisible: async () => true,
      evaluate: (_fn, _arg, options) => {
        looks.push(options?.timeout);
        if (!gone) return Promise.resolve(facts);
        // A locator whose element went waits for it until its timeout, and without one for ever.
        return options?.timeout ? Promise.reject(new Error(`timeout ${options.timeout}ms`)) : new Promise(() => {});
      },
    });
    const page = {
      getByRole: (role) => ({ all: async () => (role === 'link' ? [control({ name: 'Home' }), control({ name: 'Plan' }, true)] : []) }),
    };
    expect(await controls(page)).toEqual([{ role: 'link', nth: 0, name: 'Home' }]);
    expect(looks).toHaveLength(2);
    for (const timeout of looks) expect(timeout).toBeGreaterThan(0);
    for (const timeout of looks) expect(timeout).toBeLessThanOrEqual(2_000);
  });
});
