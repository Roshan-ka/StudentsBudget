import { describe, expect, it } from 'vitest';
import { choiceOf, DEFAULT_THEME_CHOICE, THEME_COLORS, THEME_STORAGE_KEY, themeHeadScript, themeOf } from './themes';

type Run = { stored?: string | null; phoneDark?: boolean; storageThrows?: boolean; meta?: boolean };

type Meta = { content: string; setAttribute: (name: string, value: string) => void };

function metaOf(content: string): Meta {
  const meta: Meta = { content, setAttribute: (name, value) => name === 'content' && (meta.content = value) };
  return meta;
}

/**
 * Runs the head script against a stand-in browser and returns what it put on <html> and the theme-color meta, and how
 * many metas it added to <head>.
 */
function run({ stored = null, phoneDark = false, storageThrows = false, meta = true }: Run) {
  const classes = new Set<string>();
  const documentElement = {
    classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
    style: { colorScheme: '' },
  };
  let themeColor: Meta | null = meta ? metaOf(THEME_COLORS.light) : null;
  let added = 0;
  const head = {
    appendChild(element: Meta) {
      themeColor = element;
      added += 1;
    },
  };
  const document = { documentElement, head, createElement: () => metaOf(''), querySelector: () => themeColor };
  const localStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error('blocked');
      return key === THEME_STORAGE_KEY ? stored : null;
    },
  };
  const window = { matchMedia: () => ({ matches: phoneDark }) };
  new Function('document', 'localStorage', 'window', themeHeadScript())(document, localStorage, window);
  return { dark: classes.has('dark'), scheme: documentElement.style.colorScheme, themeColor: themeColor?.content, added };
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
  const light = { dark: false, scheme: 'light', themeColor: THEME_COLORS.light, added: 0 };
  const dark = { dark: true, scheme: 'dark', themeColor: THEME_COLORS.dark, added: 0 };

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

  it('draws the page light when storage can’t be read, theme-color included', () => {
    expect(run({ storageThrows: true, phoneDark: true })).toEqual(light);
    expect(run({ storageThrows: true, meta: false })).toEqual({ ...light, added: 1 });
  });

  it('adds the one theme-color meta when the page has none, as the layout renders it', () => {
    expect(run({ stored: 'dark', meta: false })).toEqual({ ...dark, added: 1 });
    expect(run({ meta: false })).toEqual({ ...light, added: 1 });
  });
});
