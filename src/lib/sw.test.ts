import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// These tests run the real public/sw.js in a Node `vm` context against stubbed browser APIs and drive it
// through the `fetch`, `install` and `activate` handlers it registers, the way the browser does. Time is
// faked, so the 4 s navigation fallback costs nothing.

const SOURCE = readFileSync(fileURLToPath(new URL('../../public/sw.js', import.meta.url)), 'utf8');
const ORIGIN = 'https://studentsbudget.test';
const CACHE_NAME = 'studentsbudget-build-a';
const PAGES = ['/', '/entries', '/entries/new', '/charts', '/tips', '/badges', '/check-in', '/reveal', '/settings', '/setup'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A response of the kind the cache accepts: `type` 'basic', as one from our own origin has. */
function basic(body: string, status = 200): Response {
  return Object.defineProperty(new Response(body, { status }), 'type', { value: 'basic' });
}

const textOf = async (response: Response | undefined) => (await response?.text()) ?? '(nothing)';

type CacheOptions = { ignoreSearch?: boolean; ignoreVary?: boolean };

/** The part of the Cache API the worker uses. Keys are resolved to full URLs, as the browser does. */
class FakeCache {
  readonly entries = new Map<string, Response>();
  /** Every key written through `put`; seeding with `seed` is not counted. */
  readonly puts: string[] = [];

  private static key(input: string | { url: string }, ignoreSearch = false): string {
    const url = new URL(typeof input === 'string' ? input : input.url, ORIGIN);
    if (ignoreSearch) url.search = '';
    return url.href;
  }

  seed(path: string, body: string) {
    this.entries.set(FakeCache.key(path), basic(body));
  }

  async put(input: string | { url: string }, response: Response) {
    const key = FakeCache.key(input);
    this.puts.push(key);
    this.entries.set(key, response);
  }

  async match(input: string | { url: string }, options: CacheOptions = {}) {
    const wanted = FakeCache.key(input, options.ignoreSearch);
    for (const [key, response] of this.entries) {
      if (FakeCache.key(key, options.ignoreSearch) === wanted) return response.clone();
    }
    return undefined;
  }
}

/** What the page sees of a handled event. */
type Handled = {
  /** Whether `respondWith` was called. */
  answered: boolean;
  status: 'pending' | 'fulfilled' | 'rejected';
  response?: Response;
  error?: unknown;
  /** The promises passed to `waitUntil`, in order. */
  lifetime: Promise<unknown>[];
};

type FakeEvent = {
  request?: { url: string; method: string; mode: string };
  respondWith: (answer: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
};

/** How the stubbed network answers: a script per test. */
type Network = (input: string | { url: string }) => Promise<Response>;

/**
 * Loads sw.js as /sw.js?v=build-a would run it. The events follow the service worker spec where it matters:
 * `respondWith` works only while the event is being dispatched, and `waitUntil` only while it is being
 * dispatched or while a promise passed to `respondWith` or `waitUntil` is still pending.
 */
function loadWorker(network: Network) {
  const handlers = new Map<string, ((event: FakeEvent) => void)[]>();
  const cache = new FakeCache();
  const caches = {
    open: async () => cache,
    keys: async () => [CACHE_NAME, 'studentsbudget-build-old', 'someone-elses-cache'],
    delete: vi.fn(async () => true),
  };
  const self = {
    location: new URL(`${ORIGIN}/sw.js?v=build-a`),
    addEventListener: (type: string, handler: (event: FakeEvent) => void) => {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
    },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  const fetchStub = vi.fn(network);

  const context = vm.createContext({
    self,
    caches,
    fetch: fetchStub,
    Response,
    Request,
    URL,
    // The fake timers replace the global functions after this file loads, so look them up at call time.
    setTimeout: (handler: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) =>
      globalThis.setTimeout(handler, ms, ...args),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
  });
  vm.runInContext(SOURCE, context, { filename: 'public/sw.js' });

  function dispatch(type: string, request?: FakeEvent['request']): Handled {
    const handled: Handled = { answered: false, status: 'pending', lifetime: [] };
    let dispatching = true;
    let pending = 0;
    const extend = (work: Promise<unknown>) => {
      pending += 1;
      const done = () => {
        pending -= 1;
      };
      work.then(done, done);
    };
    const event: FakeEvent = {
      request,
      respondWith(answer) {
        if (!dispatching) throw new DOMException('respondWith() after the event was dispatched', 'InvalidStateError');
        handled.answered = true;
        const settled = Promise.resolve(answer);
        extend(settled);
        settled.then(
          (response) => Object.assign(handled, { status: 'fulfilled', response }),
          (error: unknown) => Object.assign(handled, { status: 'rejected', error }),
        );
      },
      waitUntil(work) {
        if (!dispatching && pending === 0) {
          throw new DOMException('waitUntil() while the event is no longer active', 'InvalidStateError');
        }
        const settled = Promise.resolve(work);
        handled.lifetime.push(settled);
        extend(settled);
      },
    };
    try {
      for (const handler of handlers.get(type) ?? []) handler(event);
    } finally {
      dispatching = false;
    }
    return handled;
  }

  /** A GET the page makes: a navigation (`mode: 'navigate'`) or a subresource. */
  const get = (url: string, mode = 'navigate') => dispatch('fetch', { url: new URL(url, ORIGIN).href, method: 'GET', mode });

  return { cache, caches, self, fetchStub, dispatch, get };
}

/** A network that answers every request after `ms`; `body` can depend on the path. */
function slowNetwork(ms: number, body: string): Network {
  return () => new Promise((resolve) => setTimeout(() => resolve(basic(body)), ms));
}

/** Airplane mode: every request fails at once, the way fetch fails with no connection. */
const offline: Network = () => Promise.reject(new TypeError('Failed to fetch'));

describe('navigations', () => {
  it('answers a slow navigation from the cached page at 4 s, and the late network answer never changes the cache', async () => {
    // The two-build bug: build A is installed and its cache holds A's page; the server now runs build B and
    // takes 6 s. B's page names chunks that A's cache does not hold, so saving it would break the next offline open.
    const worker = loadWorker(slowNetwork(6000, 'build B page'));
    worker.cache.seed('/', 'build A page');

    const navigation = worker.get('/');
    await vi.advanceTimersByTimeAsync(3999);
    expect(navigation.status).toBe('pending');

    await vi.advanceTimersByTimeAsync(1);
    expect(navigation.status).toBe('fulfilled');
    expect(await textOf(navigation.response)).toBe('build A page');

    // The late answer arrives at 6 s. The network was asked once, and the cache is exactly as it was.
    await vi.advanceTimersByTimeAsync(2000);
    expect(worker.fetchStub).toHaveBeenCalledTimes(1);
    expect(worker.cache.puts).toEqual([]);
    expect(await textOf(await worker.cache.match('/'))).toBe('build A page');
  });

  it('answers a navigation that fails at once (offline) from the cache at once, not after 4 s', async () => {
    const worker = loadWorker(offline);
    worker.cache.seed('/', 'build A page');

    const navigation = worker.get('/');
    // No time passes at all, only the promise jobs of the cache lookup.
    await vi.advanceTimersByTimeAsync(0);

    expect(navigation.status).toBe('fulfilled');
    expect(await textOf(navigation.response)).toBe('build A page');
    // The 4 s timer was cancelled, not left to fire.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps waiting for a slow network when there is no cached copy, and still saves nothing', async () => {
    const worker = loadWorker(slowNetwork(6000, 'build B page'));

    const navigation = worker.get('/charts');
    await vi.advanceTimersByTimeAsync(4001);
    expect(navigation.status).toBe('pending');

    await vi.advanceTimersByTimeAsync(1999);
    expect(navigation.status).toBe('fulfilled');
    expect(await textOf(navigation.response)).toBe('build B page');
    expect(worker.cache.puts).toEqual([]);
  });

  it('fails with the network error when offline and nothing is cached', async () => {
    const worker = loadWorker(offline);

    const navigation = worker.get('/charts');
    await vi.advanceTimersByTimeAsync(0);

    expect(navigation.status).toBe('rejected');
    expect(navigation.error).toBeInstanceOf(TypeError);
  });

  it('answers a navigation to /entries?month=2026-10 from the cached /entries when offline', async () => {
    const worker = loadWorker(offline);
    worker.cache.seed('/', 'home page');
    worker.cache.seed('/entries', 'entries page');

    const navigation = worker.get('/entries?month=2026-10');
    await vi.advanceTimersByTimeAsync(0);

    expect(navigation.status).toBe('fulfilled');
    expect(await textOf(navigation.response)).toBe('entries page');
  });

  it('shows an online page from the network, and does not save it either', async () => {
    const worker = loadWorker(() => Promise.resolve(basic('build A page, fresh')));
    worker.cache.seed('/', 'build A page');

    const navigation = worker.get('/');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all(navigation.lifetime);

    expect(await textOf(navigation.response)).toBe('build A page, fresh');
    expect(worker.cache.puts).toEqual([]);
    expect(await textOf(await worker.cache.match('/'))).toBe('build A page');
  });
});

describe("requests that are not the worker's", () => {
  it('does not handle a request to api.frankfurter.dev', async () => {
    const worker = loadWorker(offline);

    const rates = worker.get('https://api.frankfurter.dev/v1/latest?base=EUR&symbols=INR', 'cors');

    expect(rates.answered).toBe(false);
    expect(worker.fetchStub).not.toHaveBeenCalled();
  });

  it('does not handle a same-origin POST, nor a navigation that is not a page (the calendar file)', async () => {
    const worker = loadWorker(offline);

    const post = worker.dispatch('fetch', { url: `${ORIGIN}/entries`, method: 'POST', mode: 'cors' });
    const calendar = worker.get('/weekly-check-in.ics');

    expect(post.answered).toBe(false);
    expect(calendar.answered).toBe(false);
  });
});

describe('static files', () => {
  it('serves a hashed chunk from the cache first, saving it after the first online visit', async () => {
    const worker = loadWorker(() => Promise.resolve(basic('console.log(1)')));

    const first = worker.get('/_next/static/chunks/app-1.js', 'no-cors');
    await vi.advanceTimersByTimeAsync(0);
    // `waitUntil` runs while the answer is still being awaited, which is when the browser allows it.
    await Promise.all(first.lifetime);
    expect(first.lifetime).toHaveLength(1);
    expect(await textOf(first.response)).toBe('console.log(1)');
    expect(worker.cache.puts).toEqual([`${ORIGIN}/_next/static/chunks/app-1.js`]);

    const second = worker.get('/_next/static/chunks/app-1.js', 'no-cors');
    await vi.advanceTimersByTimeAsync(0);
    expect(await textOf(second.response)).toBe('console.log(1)');
    expect(worker.fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe('install and activate', () => {
  it('precaches every document and the files they name, with waitUntil called during dispatch', async () => {
    const worker = loadWorker((input) => {
      const path = new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname;
      if (path.startsWith('/_next/static/')) return Promise.resolve(basic('asset'));
      return Promise.resolve(basic(`<html>${path}<script src="/_next/static/chunks/app-1.js"></script></html>`));
    });

    const install = worker.dispatch('install');

    // Called synchronously during dispatch: waitUntil() would throw otherwise, as it does in the browser.
    expect(install.lifetime).toHaveLength(1);
    expect(worker.self.skipWaiting).toHaveBeenCalledOnce();
    await Promise.all(install.lifetime);
    for (const page of PAGES) expect(worker.cache.entries.has(`${ORIGIN}${page}`)).toBe(true);
    expect(worker.cache.entries.has(`${ORIGIN}/_next/static/chunks/app-1.js`)).toBe(true);
  });

  it('deletes only the older studentsbudget caches on activate, then takes over the open pages', async () => {
    const worker = loadWorker(offline);

    const activate = worker.dispatch('activate');

    expect(activate.lifetime).toHaveLength(1);
    await Promise.all(activate.lifetime);
    expect(worker.caches.delete).toHaveBeenCalledExactlyOnceWith('studentsbudget-build-old');
    expect(worker.self.clients.claim).toHaveBeenCalledOnce();
  });
});
