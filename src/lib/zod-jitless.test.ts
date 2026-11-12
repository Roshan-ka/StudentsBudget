import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { ZOD_JITLESS_HEAD_SCRIPT } from './zod-jitless';

describe('Zod without eval (legal pages, chunk 4)', () => {
  it('turns jitless on in a fresh page, and keeps any setting already there', () => {
    // The context object is the script's global, `globalThis` included.
    const fresh: { __zod_globalConfig?: Record<string, unknown> } = {};
    runInNewContext(ZOD_JITLESS_HEAD_SCRIPT, fresh);
    expect(fresh.__zod_globalConfig).toEqual({ jitless: true });

    const set = { __zod_globalConfig: { locale: 'de' } } as { __zod_globalConfig: Record<string, unknown> };
    runInNewContext(ZOD_JITLESS_HEAD_SCRIPT, set);
    expect(set.__zod_globalConfig).toEqual({ locale: 'de', jitless: true });
  });

  it('matches what the installed Zod reads, so a Zod update that moves it fails here', () => {
    // Zod's core takes its global settings from this object as it loads ...
    const core = readFileSync('node_modules/zod/v4/core/core.js', 'utf8');
    expect(core).toContain('globalThis.__zod_globalConfig');
    // ... and an object schema skips its `new Function` probe under `jitless`.
    const util = readFileSync('node_modules/zod/v4/core/util.js', 'utf8');
    expect(util).toMatch(/allowsEval = [^]*?if \(globalConfig\.jitless\) \{\s*return false;/);
  });
});
