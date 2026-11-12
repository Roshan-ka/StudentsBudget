import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inRegensburgBox, REGENSBURG_BOX } from './regensburg-box';

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

  it('holds a position inside it, its edges included, and nothing else', () => {
    expect(inRegensburgBox(49.01936, 12.08965)).toBe(true);
    expect(inRegensburgBox(REGENSBURG_BOX.south, REGENSBURG_BOX.west)).toBe(true);
    expect(inRegensburgBox(REGENSBURG_BOX.north, REGENSBURG_BOX.east)).toBe(true);
    expect(inRegensburgBox(48.13743, 11.57549)).toBe(false);
    expect(inRegensburgBox(49.02, 12.21)).toBe(false);
    expect(inRegensburgBox(Number.NaN, 12.1)).toBe(false);
    expect(inRegensburgBox(49.02, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('is a box, south of north and west of east', () => {
    expect(REGENSBURG_BOX.south).toBeLessThan(REGENSBURG_BOX.north);
    expect(REGENSBURG_BOX.west).toBeLessThan(REGENSBURG_BOX.east);
  });
});
