import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The `ai` function runs on Deno, which takes its packages from deno.json's import map; the app's typecheck and tests
// read the same packages from package.json. They must be the same versions (the AI phase, chunk 3), or the function
// would run code the tests never ran.

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

describe('the ai function’s packages', () => {
  it('are pinned in deno.json to the exact versions package.json has', () => {
    const imports: Record<string, string> = read('supabase/functions/ai/deno.json').imports;
    const pkg = read('package.json');
    const versions: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

    const pinned = Object.entries(imports).map(([name, target]) => {
      const match = /^npm:\/?(@?[^@]+)@([^/]+)\/?$/.exec(target);
      return { name: name.replace(/\/$/, ''), target, package: match?.[1], version: match?.[2] };
    });
    expect(pinned.map((entry) => entry.name).sort()).toEqual(['@anthropic-ai/sdk', '@anthropic-ai/sdk', '@supabase/supabase-js', 'zod']);
    for (const entry of pinned) {
      expect(entry.package, entry.target).toBe(entry.name);
      expect(entry.version, entry.name).toMatch(/^\d+\.\d+\.\d+$/);
      expect(versions[entry.name], entry.name).toBe(entry.version);
    }
  });

  it('match the weekly reminder’s supabase-js', () => {
    const reminder = read('supabase/functions/weekly-reminder/deno.json').imports['@supabase/supabase-js'];
    expect(read('supabase/functions/ai/deno.json').imports['@supabase/supabase-js']).toBe(reminder);
  });
});
