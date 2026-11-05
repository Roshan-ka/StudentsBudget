import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markNoteSeen, noteSeen, PRIVACY_NOTES } from './notes';

let stored: Record<string, string>;

beforeEach(() => {
  stored = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      stored[key] = value;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the data-protection note flags', () => {
  it('are unseen on a new phone, and each is seen once accepted, under its own key', () => {
    expect(noteSeen('account')).toBe(false);
    markNoteSeen('account');
    expect(noteSeen('account')).toBe(true);
    expect(stored[PRIVACY_NOTES.account]).toBe('seen');
    // One note accepted says nothing about another.
    expect(noteSeen('passkey')).toBe(false);
  });

  it('keep the mic note’s older key, so a phone that accepted it isn’t asked again', () => {
    stored['studentsbudget-mic-note'] = 'seen';
    expect(noteSeen('mic')).toBe(true);
  });

  it('give every note a key of its own', () => {
    const keys = Object.values(PRIVACY_NOTES);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('read blocked storage as unseen, and never throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(noteSeen('mic')).toBe(false);
    expect(() => markNoteSeen('mic')).not.toThrow();
  });
});
