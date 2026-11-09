import { describe, expect, it } from 'vitest';
import { allowanceOf } from '../../../../supabase/functions/_shared/ai/allowance';

// Reading take_ai_allowance's answer (the AI phase, chunk 3; the migration's hints in chunk 1).

describe('allowanceOf', () => {
  it('reads what is left, and null for a moderator', () => {
    expect(allowanceOf({ data: 5, error: null })).toEqual({ ok: true, left: 5 });
    expect(allowanceOf({ data: 0, error: null })).toEqual({ ok: true, left: 0 });
    expect(allowanceOf({ data: null, error: null })).toEqual({ ok: true, left: null });
  });

  it('takes the function’s hints as the problem', () => {
    for (const hint of ['signed-out', 'second-step', 'daily-limit', 'busy'] as const) {
      expect(allowanceOf({ data: null, error: { code: hint === 'daily-limit' || hint === 'busy' ? 'P0001' : '42501', hint } })).toEqual({
        ok: false,
        problem: hint,
      });
    }
  });

  it('counts a token PostgREST doesn’t take, or a key alone, as signed out', () => {
    for (const code of ['PGRST301', 'PGRST302', 'PGRST303', '42501']) {
      expect(allowanceOf({ data: null, error: { code, hint: null, message: 'no' } })).toEqual({ ok: false, problem: 'signed-out' });
    }
  });

  it('is unavailable for anything else, and for an answer that isn’t a count', () => {
    expect(allowanceOf({ data: null, error: { code: '57014', message: 'canceling statement' } })).toEqual({
      ok: false,
      problem: 'unavailable',
    });
    expect(allowanceOf({ data: null, error: { message: 'fetch failed' } })).toEqual({ ok: false, problem: 'unavailable' });
    expect(allowanceOf({ data: '5', error: null })).toEqual({ ok: false, problem: 'unavailable' });
    expect(allowanceOf({ data: -1, error: null })).toEqual({ ok: false, problem: 'unavailable' });
  });
});
