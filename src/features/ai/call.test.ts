import { afterEach, describe, expect, it, vi } from 'vitest';
import { callAi, type AiCallDeps } from './call';
import { quickAddAnswer, type QuickAddAnswer, type QuickAddRequest } from './contract';

const LINE: QuickAddRequest = {
  feature: 'quick-add',
  lang: 'en',
  today: '2026-11-09',
  line: '12 for pizza with Tom yesterday, paid cash',
  categories: [{ id: 'eating-out', name: 'Eating out' }],
  accounts: [{ ref: 'a1', name: 'Cash', kind: 'cash', currency: 'EUR' }],
};

const ANSWER: QuickAddAnswer = {
  amount: 12,
  otherAmount: null,
  note: 'pizza with Tom',
  categoryId: 'eating-out',
  accountRef: 'a1',
  date: '2026-11-08',
};

const URL = 'https://project.supabase.co/functions/v1/ai';

/** A fetch that answers `body` with `status`, and remembers what it was asked. */
function answering(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

/** A fetch that answers only when its signal aborts it, as a slow function would. */
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
  });

function deps(overrides: Partial<AiCallDeps> = {}): AiCallDeps {
  return {
    fetch: answering({ ok: true, answer: ANSWER, left: 49 }),
    endpoint: () => ({ url: URL, publishableKey: 'sb_publishable_test' }),
    token: async () => 'session-token',
    online: () => true,
    allowed: () => true,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('callAi', () => {
  it('posts the request with the session token to the function, and returns the answer and the uses left', async () => {
    const fetch = answering({ ok: true, answer: ANSWER, left: 49 });

    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch }))).toEqual({ ok: true, answer: ANSWER, left: 49 });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(URL);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { authorization: 'Bearer session-token', apikey: 'sb_publishable_test', 'content-type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual(LINE);
  });

  it('takes a null "left" as no limit (a moderator)', async () => {
    const fetch = answering({ ok: true, answer: ANSWER, left: null });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch }))).toEqual({ ok: true, answer: ANSWER, left: null });
  });

  describe('sends nothing', () => {
    it('when the build has no AI or the phone’s switch is off', async () => {
      const fetch = answering({});
      const token = vi.fn(async () => 'session-token');

      expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch, token, allowed: () => false }))).toEqual({
        ok: false,
        problem: 'off',
      });
      expect(fetch).not.toHaveBeenCalled();
      // Not even the session is read.
      expect(token).not.toHaveBeenCalled();
    });

    it('when the build has no Supabase project', async () => {
      const fetch = answering({});
      expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch, endpoint: () => null }))).toEqual({
        ok: false,
        problem: 'off',
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('with nobody signed in', async () => {
      const fetch = answering({});
      expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch, token: async () => null }))).toEqual({
        ok: false,
        problem: 'signed-out',
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('offline', async () => {
      const fetch = answering({});
      expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch, online: () => false }))).toEqual({
        ok: false,
        problem: 'offline',
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('for a request the contract refuses, and logs where without what the student wrote', async () => {
      const fetch = answering({});
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const broken = { ...LINE, line: '' };

      expect(await callAi(broken, quickAddAnswer, {}, deps({ fetch }))).toEqual({ ok: false, problem: 'bad-request' });
      expect(fetch).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.mock.calls[0])).not.toContain('pizza');
    });

    it('when the caller has already given up', async () => {
      const fetch = answering({});
      const controller = new AbortController();
      controller.abort();

      expect(await callAi(LINE, quickAddAnswer, { signal: controller.signal }, deps({ fetch }))).toEqual({
        ok: false,
        problem: 'aborted',
      });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('passes on the function’s own problem', async () => {
    for (const [problem, status] of [
      ['daily-limit', 429],
      ['second-step', 403],
      ['busy', 503],
      ['refused', 422],
    ] as const) {
      const fetch = answering({ ok: false, problem }, status);
      expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch }))).toEqual({ ok: false, problem });
    }
  });

  it('reads a refusal without the contract’s body by its status', async () => {
    const htmlError = (status: number) => vi.fn<typeof fetch>(async () => new Response('<html>Bad gateway</html>', { status }));

    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch: htmlError(401) }))).toEqual({ ok: false, problem: 'signed-out' });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch: htmlError(429) }))).toEqual({ ok: false, problem: 'daily-limit' });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch: htmlError(502) }))).toEqual({ ok: false, problem: 'unavailable' });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch: htmlError(404) }))).toEqual({ ok: false, problem: 'failed' });
  });

  it('calls an answer the contract doesn’t allow a failure', async () => {
    const fetch = answering({ ok: true, answer: { ...ANSWER, amount: 'twelve' }, left: 49 });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch }))).toEqual({ ok: false, problem: 'failed' });
  });

  it('gives up after the feature’s time: 8 seconds for quick add', async () => {
    vi.useFakeTimers();
    const result = callAi(LINE, quickAddAnswer, {}, deps({ fetch: hanging }));

    await vi.advanceTimersByTimeAsync(7_999);
    await vi.advanceTimersByTimeAsync(1);

    expect(await result).toEqual({ ok: false, problem: 'timeout' });
  });

  it('gives up after the time the caller sets', async () => {
    vi.useFakeTimers();
    const result = callAi(LINE, quickAddAnswer, { timeoutMs: 2_000 }, deps({ fetch: hanging }));

    await vi.advanceTimersByTimeAsync(2_000);

    expect(await result).toEqual({ ok: false, problem: 'timeout' });
  });

  it('stops when the caller aborts, and never hands on an answer that came after', async () => {
    const controller = new AbortController();
    const waiting = callAi(LINE, quickAddAnswer, { signal: controller.signal }, deps({ fetch: hanging }));
    controller.abort();
    expect(await waiting).toEqual({ ok: false, problem: 'aborted' });

    // A fetch that ignores the signal and answers anyway: the answer is stale.
    const late = new AbortController();
    const answersAnyway = vi.fn<typeof globalThis.fetch>(async () => {
      late.abort();
      return new Response(JSON.stringify({ ok: true, answer: ANSWER, left: 49 }));
    });
    expect(await callAi(LINE, quickAddAnswer, { signal: late.signal }, deps({ fetch: answersAnyway }))).toEqual({
      ok: false,
      problem: 'aborted',
    });
  });

  it('says offline when the connection drops during the call, and unavailable otherwise', async () => {
    let online = true;
    const dropping = vi.fn<typeof fetch>(async () => {
      online = false;
      throw new TypeError('Failed to fetch');
    });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch: dropping, online: () => online }))).toEqual({
      ok: false,
      problem: 'offline',
    });

    const failing = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await callAi(LINE, quickAddAnswer, {}, deps({ fetch: failing }))).toEqual({ ok: false, problem: 'unavailable' });
  });
});
