import { describe, expect, it } from 'vitest';
import { supabaseBuildProblem } from './supabase-build-check.mjs';

const URL_OK = 'https://abcdefghijklmnop.supabase.co';
const KEY_OK = 'sb_publishable_abc123';
const SECRET = 'sb_secret_abc123';

const envOf = (url, key) => ({ NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });

describe('supabaseBuildProblem', () => {
  it('lets a build with neither setting through: the app is local-only by choice', () => {
    expect(supabaseBuildProblem({})).toBeNull();
    expect(supabaseBuildProblem(envOf('', ''))).toBeNull();
    expect(supabaseBuildProblem(envOf('  ', '\n'))).toBeNull();
  });

  it('lets a build with both settings through', () => {
    expect(supabaseBuildProblem(envOf(URL_OK, KEY_OK))).toBeNull();
    expect(supabaseBuildProblem(envOf(` ${URL_OK} `, ` ${KEY_OK}\n`))).toBeNull();
  });

  it('stops a build with the URL and no key, as the live site went out on 12-11-2026', () => {
    expect(supabaseBuildProblem({ NEXT_PUBLIC_SUPABASE_URL: URL_OK })).toMatch(
      /^NEXT_PUBLIC_SUPABASE_URL is set but NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not/,
    );
    // An empty or blank key counts as no key.
    expect(supabaseBuildProblem(envOf(URL_OK, ''))).toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not/);
    expect(supabaseBuildProblem(envOf(URL_OK, '   '))).toMatch(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not/);
  });

  it('stops a build with the key and no URL', () => {
    expect(supabaseBuildProblem({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: KEY_OK })).toMatch(
      /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set but NEXT_PUBLIC_SUPABASE_URL is not/,
    );
  });

  it('stops a build with a secret key, with or without the URL', () => {
    expect(supabaseBuildProblem(envOf(URL_OK, SECRET))).toMatch(/holds a secret key/);
    expect(supabaseBuildProblem(envOf('', SECRET))).toMatch(/holds a secret key/);
  });

  it('never writes a value into its message', () => {
    for (const env of [envOf(URL_OK, ''), envOf('', KEY_OK), envOf(URL_OK, SECRET)]) {
      const problem = supabaseBuildProblem(env);
      expect(problem).not.toBeNull();
      expect(problem).not.toContain(URL_OK);
      expect(problem).not.toContain(KEY_OK);
      expect(problem).not.toContain(SECRET);
    }
  });
});
