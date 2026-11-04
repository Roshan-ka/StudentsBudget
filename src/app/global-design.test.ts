import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '@/i18n/languages';
import { REGIONS } from '@/i18n/regions';

// Guards for the global design rules (redesign plan, chunk 10: docs/superpowers/plans/2026-11-04-redesign.md): one
// design for every region, with region layers that can't fork it; fonts that cover every language's script; and
// logical sides, so a right-to-left language mirrors the layout without a rewrite.

const SRC = fileURLToPath(new URL('..', import.meta.url));
const css = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

function filesIn(dir: string, ending: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path, ending);
    return entry.name.endsWith(ending) ? [path] : [];
  });
}

/** A source file's code without its comments, so a comment that says "right-to-left" is no class. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** A Tailwind class for a physical side: margins, paddings, insets, borders, corners and alignment by left or right. */
const PHYSICAL =
  /^-?(?:(?:scroll-)?[mp][lr]-|(?:left|right)-|border-[lr](?:-|$)|rounded-(?:[lr]|[tb][lr])(?:-|$)|(?:text|float)-(?:left|right)$)/;

/** The physical-side classes in a file: each token of its code, without its variants (`hover:`, `has-[…]:`). */
function physicalClasses(source: string): string[] {
  return withoutComments(source)
    .split(/[\s"'`{}(),;]+/)
    .map((token) => token.slice(token.lastIndexOf(':') + 1))
    .filter((base) => PHYSICAL.test(base));
}

/** Files not yet on logical sides: the list only shrinks, and is empty since quick add's restyle (chunk 12). */
const NOT_YET_LOGICAL = new Set<string>();

describe('logical sides', () => {
  const files = filesIn(SRC, '.tsx').map((path) => relative(SRC, path).replaceAll('\\', '/'));

  it('uses start and end, not left and right, outside the files not done yet', () => {
    const found = files
      .filter((file) => !NOT_YET_LOGICAL.has(file))
      .flatMap((file) => physicalClasses(readFileSync(join(SRC, file), 'utf8')).map((name) => `${file}: ${name}`));
    expect(found).toEqual([]);
  });

  it('lists only files that exist and still have a physical side', () => {
    for (const file of NOT_YET_LOGICAL) {
      expect(files, file).toContain(file);
      expect(physicalClasses(readFileSync(join(SRC, file), 'utf8')), file).not.toEqual([]);
    }
  });

  it('finds the physical classes and leaves the logical ones and the prose alone', () => {
    expect(physicalClasses('className="ml-2 has-data-[icon=x]:pr-1.5 text-left -right-1 border-l rounded-tl-lg"')).toEqual(
      ['ml-2', 'pr-1.5', 'text-left', '-right-1', 'border-l', 'rounded-tl-lg'],
    );
    expect(physicalClasses('className="ms-2 pe-1.5 text-start -end-1 border-s px-4 rounded-lg" // right-to-left')).toEqual([]);
  });
});

describe('the region layers', () => {
  const dir = fileURLToPath(new URL('./regions/', import.meta.url));
  const layers = filesIn(dir, '.css');

  it('has one layer per region, imported by globals.css', () => {
    const codes = layers.map((path) => relative(dir, path).replace(/\.css$/, '')).sort();
    expect(codes).toEqual(Object.keys(REGIONS).sort());
    for (const code of codes) expect(css, code).toContain(`@import "./regions/${code}.css";`);
  });

  it('sets only --region-* tokens, under its own data-region, never the shared design', () => {
    for (const path of layers) {
      const code = relative(dir, path).replace(/\.css$/, '');
      const source = withoutComments(readFileSync(path, 'utf8'));
      for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        expect(selector.trim(), code).toBe(`[data-region='${code}']`);
        for (const declaration of body.split(';').map((d) => d.trim()).filter(Boolean)) {
          expect(declaration, `${code}: ${declaration}`).toMatch(/^--region-[\w-]+\s*:/);
        }
      }
    }
  });
});

describe('fonts for every script', () => {
  it('gives a language in a script other than Latin its own fonts', () => {
    for (const [code, { script }] of Object.entries(LANGUAGES)) {
      if (script === 'Latn') continue;
      const block = css.match(new RegExp(`:lang\\(${code}\\)\\s*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(block, `${code} (${script}) needs a :lang(${code}) block`).toContain('--font-sans');
      expect(block, `${code} (${script}) needs a :lang(${code}) block`).toContain('--font-heading');
    }
  });

  it('names a script for every language', () => {
    for (const [code, { script }] of Object.entries(LANGUAGES)) expect(script, code).toMatch(/^[A-Z][a-z]{3}$/);
  });
});

describe('motion', () => {
  /** The animation classes in a file that run whatever the person asked for: `animate-*` without `motion-safe:`. */
  function unguardedAnimations(source: string): string[] {
    return withoutComments(source)
      .split(/[\s"'`{}(),;]+/)
      .filter((token) => /(^|:)animate-(?!none$)/.test(token) && !token.split(':').includes('motion-safe'));
  }

  it('moves nothing for someone who asked for reduced motion (chunk 11)', () => {
    const found = filesIn(SRC, '.tsx').flatMap((path) =>
      unguardedAnimations(readFileSync(path, 'utf8')).map((name) => `${relative(SRC, path)}: ${name}`),
    );
    expect(found).toEqual([]);
  });

  it('finds an animation without the guard and leaves a guarded one alone', () => {
    expect(unguardedAnimations('className="animate-spin hover:animate-bar-fill motion-safe:animate-ring-fill"')).toEqual([
      'animate-spin',
      'hover:animate-bar-fill',
    ]);
  });

  it('defines the keyframes each guarded animation names', () => {
    for (const name of ['bar-fill', 'ring-fill']) {
      expect(css, name).toContain(`--animate-${name}: ${name} `);
      expect(css, name).toMatch(new RegExp(`@keyframes ${name}\\s*\\{`));
    }
  });
});
