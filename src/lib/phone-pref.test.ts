import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPref, writePref } from './phone-pref';

function fakeStorage(store: Map<string, string>, broken = false) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (broken) throw new Error('blocked');
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (broken) throw new Error('blocked');
      store.set(key, value);
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('phone preferences', () => {
  it('reads back what was written, and null for nothing stored', () => {
    fakeStorage(new Map());
    expect(readPref('studentsbudget-test')).toBeNull();
    writePref('studentsbudget-test', 'x');
    expect(readPref('studentsbudget-test')).toBe('x');
  });

  it('is null, and quiet, when storage is blocked', () => {
    fakeStorage(new Map(), true);
    expect(() => writePref('studentsbudget-test', 'x')).not.toThrow();
    expect(readPref('studentsbudget-test')).toBeNull();
  });
});
