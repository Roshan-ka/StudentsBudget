import { describe, expect, it } from 'vitest';
import { allowedOrigins, corsHeaders } from '../../../../supabase/functions/_shared/ai/cors';

// Which pages may read the AI function's answers in a browser (the AI phase, chunk 2).

describe('allowedOrigins', () => {
  it('reads https origins and the local dev server, and leaves out anything else', () => {
    const origins = allowedOrigins(
      ' https://students-budget.vercel.app , http://localhost:3000,https://example.com/, http://example.com, https://example.org/app, not a url,,',
    );
    expect([...origins]).toEqual(['https://students-budget.vercel.app', 'http://localhost:3000', 'https://example.com']);
  });

  it('allows nothing without the setting', () => {
    expect(allowedOrigins(undefined).size).toBe(0);
    expect(allowedOrigins('').size).toBe(0);
  });
});

describe('corsHeaders', () => {
  const allowed = allowedOrigins('https://students-budget.vercel.app');

  it('names an allowed page, the methods and the headers the app sends', () => {
    expect(corsHeaders('https://students-budget.vercel.app', allowed)).toEqual({
      'Access-Control-Allow-Origin': 'https://students-budget.vercel.app',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    });
  });

  it('gives no headers to a call from no page, and refuses another page', () => {
    expect(corsHeaders(null, allowed)).toEqual({});
    expect(corsHeaders('https://students-budget-git-x.vercel.app', allowed)).toBeNull();
    expect(corsHeaders('https://students-budget.vercel.app', new Set())).toBeNull();
  });
});
