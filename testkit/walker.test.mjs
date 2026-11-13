import { describe, expect, it } from 'vitest';
import { fieldValue, logText, mayUse, pick, readLog, seededRandom, watch } from './walker.mjs';

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

  it('names forbidden content that became visible', async () => {
    const page = fakePage();
    const watcher = watch(page, { forbidden: [{ what: 'the reported posts', locator: { isVisible: async () => true } }] });
    await watcher.check({ n: 0, action: 'click', name: 'Admin', url: '/settings' });
    expect(watcher.problems).toEqual(['after step 0 (click "Admin" on /settings): the reported posts is shown']);
  });
});
