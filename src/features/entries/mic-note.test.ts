import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIC_NOTE_KEY, markMicNoteSeen, micNoteSeen } from './mic-note';

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

describe('the mic note flag', () => {
  it('is unseen on a new phone, and seen once accepted, under its own key', () => {
    expect(micNoteSeen()).toBe(false);
    markMicNoteSeen();
    expect(micNoteSeen()).toBe(true);
    expect(stored[MIC_NOTE_KEY]).toBe('seen');
  });

  it('reads blocked storage as unseen, and never throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(micNoteSeen()).toBe(false);
    expect(() => markMicNoteSeen()).not.toThrow();
  });
});
