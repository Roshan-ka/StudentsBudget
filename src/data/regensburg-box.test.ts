import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGENSBURG_BOX } from './regensburg-box';

const MIGRATION = 'supabase/migrations/20261111151901_discount_positions.sql';

/** A number as the migration writes it: 12 as 12.0. */
const sql = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

describe('the box around Regensburg', () => {
  it('is the box the database holds a student’s pin to (discount map, chunk 7)', () => {
    const migration = readFileSync(MIGRATION, 'utf8');
    const { south, north, west, east } = REGENSBURG_BOX;
    expect(migration).toContain(
      `lat between ${sql(south)} and ${sql(north)} and lng between ${sql(west)} and ${sql(east)}`,
    );
    expect(migration).toContain('check ((lat is null) = (lng is null))');
  });

  it('is a box, south of north and west of east', () => {
    expect(REGENSBURG_BOX.south).toBeLessThan(REGENSBURG_BOX.north);
    expect(REGENSBURG_BOX.west).toBeLessThan(REGENSBURG_BOX.east);
  });
});
