import { describe, expect, it } from 'vitest';
import { choiceOf, DEFAULT_THEME_CHOICE, THEME_COLORS, THEME_STORAGE_KEY, themeHeadScript, themeOf } from './themes';

type Run = { stored?: string | null; phoneDark?: boolean; storageThrows?: boolean; meta?: boolean };

/** Runs the head script against a stand-in browser and returns what it put on <html> and the theme-color meta. */
function run({ stored = null, phoneDark = false, storageThrows = false, meta = true }: Run) {
  const classes = new Set<string>();
  const documentElement = {
    classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
    style: { colorScheme: '' },
  };
  const themeColor = { content: THEME_COLORS.light, setAttribute: (_: string, value: string) => (themeColor.content = value) };
  const document = { documentElement, querySelector: () => (meta ? themeColor : null) };
  const localStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error('blocked');
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const window = { matchMedia: () => ({ matches: phoneDark }) };
  new Function('document', 'localStorage', 'window', themeHeadScript())(document, localStorage, window);
  return { dark: classes.has('dark'), scheme: documentElement.style.colorScheme, themeColor: themeColor.content };
}

describe('the theme choice', () => {
  it('is light on a new phone, and for a value this build does not know', () => {
    expect(DEFAULT_THEME_CHOICE).toBe('light');
    expect(choiceOf(null)).toBe('light');
    expect(choiceOf('sepia')).toBe('light');
    expect(choiceOf('dark')).toBe('dark');
    expect(choiceOf('system')).toBe('system');
  });

  it('draws Same as phone in the phone’s own theme, and the others as chosen', () => {
    expect(themeOf('system', true)).toBe('dark');
    expect(themeOf('system', false)).toBe('light');
    expect(themeOf('dark', false)).toBe('dark');
    expect(themeOf('light', true)).toBe('light');
  });
});

describe('themeHeadScript', () => {
  const light = { dark: false, scheme: 'light', themeColor: THEME_COLORS.light };
  const dark = { dark: true, scheme: 'dark', themeColor: THEME_COLORS.dark };

  it('leaves a new phone light, even when the phone itself is dark', () => {
    expect(run({ phoneDark: true })).toEqual(light);
  });

  it('puts Dark on <html> and the theme-color before the first paint', () => {
    expect(run({ stored: 'dark' })).toEqual(dark);
  });

  it('follows the phone under Same as phone', () => {
    expect(run({ stored: 'system', phoneDark: true })).toEqual(dark);
    expect(run({ stored: 'system', phoneDark: false })).toEqual(light);
  });

  it('leaves the page as rendered when storage can’t be read', () => {
    expect(run({ storageThrows: true, phoneDark: true })).toEqual({ dark: false, scheme: '', themeColor: THEME_COLORS.light });
  });

  it('still sets <html> when the page has no theme-color meta yet', () => {
    expect(run({ stored: 'dark', meta: false })).toMatchObject({ dark: true, scheme: 'dark' });
  });
});
