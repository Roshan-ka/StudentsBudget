import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let stored: Record<string, string>;

/** A fresh copy of the module, as a reload of the tab gets one. */
async function load() {
  vi.resetModules();
  return import('./recovery');
}

beforeEach(() => {
  stored = {};
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
    removeItem: (key: string) => {
      delete stored[key];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a tab’s "Forgot password" state (P2.4)', () => {
  it('is pending from the code until the new password, then says once that it changed', async () => {
    const recovery = await load();
    expect(recovery.recoveryState()).toBeNull();
    recovery.startRecovery();
    expect(recovery.recoveryState()).toBe('pending');
    // The "Password changed" line's timer never ends a reset that is still waiting.
    recovery.forgetPasswordChanged();
    expect(recovery.recoveryState()).toBe('pending');

    recovery.finishRecovery();
    expect(recovery.recoveryState()).toBe('changed');
    expect(stored[recovery.RECOVERY_KEY]).toBeUndefined();
    recovery.forgetPasswordChanged();
    expect(recovery.recoveryState()).toBeNull();
  });

  it('keeps a pending reset through a reload of the tab, and forgets it on sign-out', async () => {
    (await load()).startRecovery();
    const reloaded = await load();
    expect(reloaded.recoveryState()).toBe('pending');
    reloaded.endRecovery();
    expect((await load()).recoveryState()).toBeNull();
  });

  it('keeps the step in memory when the browser blocks storage', async () => {
    const blocked = () => {
      throw new Error('storage is blocked');
    };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    const recovery = await load();
    expect(recovery.recoveryState()).toBeNull();
    recovery.startRecovery();
    expect(recovery.recoveryState()).toBe('pending');
  });
});
