import { describe, expect, it } from 'vitest';
import { areasOf } from './ci-areas.mjs';

describe('areasOf', () => {
  it('needs nothing for notes alone', () => {
    expect(areasOf(['README.md', 'CLAUDE.md', 'docs/superpowers/plans/x.md', 'fixtures/manual-demo/README.md'])).toEqual({
      app: false,
      db: false,
    });
  });

  it('runs the app checks, not the db job, for a change to a page', () => {
    expect(areasOf(['src/features/account/account-link.tsx', 'README.md'])).toEqual({ app: true, db: false });
    expect(areasOf(['e2e/linking.spec.ts'])).toEqual({ app: true, db: false });
  });

  it('runs the db job, not the app checks, for the database or the MCP server alone', () => {
    expect(areasOf(['supabase/migrations/20261029170000_keep_watermarks.sql', 'supabase/tests/watermarks.test.sql'])).toEqual({
      app: false,
      db: true,
    });
    expect(areasOf(['mcp/budget.ts', '.mcp.json'])).toEqual({ app: false, db: false });
  });

  it('runs both for the account store and for what both stand on', () => {
    expect(areasOf(['src/sync/store.ts'])).toEqual({ app: true, db: true });
    expect(areasOf(['package-lock.json'])).toEqual({ app: true, db: true });
    expect(areasOf(['.github/workflows/ci.yml'])).toEqual({ app: true, db: true });
  });

  it('counts a path no rule names as app code', () => {
    expect(areasOf(['renovate.json'])).toEqual({ app: true, db: false });
  });
});
