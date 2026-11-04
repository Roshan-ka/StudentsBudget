import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyThemeToDocument, getThemeChoiceSnapshot, setThemeChoice, subscribeToThemeChoice } from './store';
import { THEME_COLORS, THEME_STORAGE_KEY } from './themes';

let stored: Record<string, string>;
let classes: Set<string>;
let style: { colorScheme: string };
let themeColor: string;
let phoneDark: boolean;
let storageThrows: boolean;

beforeEach(() => {
  stored = {};
  classes = new Set();
  style = { colorScheme: '' };
  themeColor = THEME_COLORS.light;
  phoneDark = false;
  storageThrows = false;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => {
      if (storageThrows) throw new Error('blocked');
      return stored[key] ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageThrows) throw new Error('blocked');
      stored[key] = value;
    },
  });
  vi.stubGlobal('document', {
    documentElement: {
      classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
      style,
    },
    querySelector: () => ({ setAttribute: (_: string, value: string) => (themeColor = value) }),
  });
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: () => ({ matches: phoneDark }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the theme store', () => {
  it('reads light when nothing was chosen, or when storage is blocked', () => {
    expect(getThemeChoiceSnapshot()).toBe('light');
    storageThrows = true;
    expect(getThemeChoiceSnapshot()).toBe('light');
  });

  it('remembers a choice on this phone, puts it on <html> and tells every subscriber', () => {
    const heard = vi.fn();
    const unsubscribe = subscribeToThemeChoice(heard);
    setThemeChoice('dark');
    expect(stored[THEME_STORAGE_KEY]).toBe('dark');
    expect(getThemeChoiceSnapshot()).toBe('dark');
    expect(classes.has('dark')).toBe(true);
    expect(style.colorScheme).toBe('dark');
    expect(themeColor).toBe(THEME_COLORS.dark);
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
    setThemeChoice('light');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(classes.has('dark')).toBe(false);
    expect(themeColor).toBe(THEME_COLORS.light);
  });

  it('draws Same as phone in the phone’s theme', () => {
    phoneDark = true;
    applyThemeToDocument('system');
    expect(classes.has('dark')).toBe(true);
    phoneDark = false;
    applyThemeToDocument('system');
    expect(classes.has('dark')).toBe(false);
  });

  it('still applies a choice when storage is blocked, for as long as the app is open', () => {
    storageThrows = true;
    setThemeChoice('dark');
    expect(classes.has('dark')).toBe(true);
  });
});
