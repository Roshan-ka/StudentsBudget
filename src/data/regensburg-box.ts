/**
 * The box around Regensburg the discount map covers, in degrees (WGS 84): south and north are latitudes, west and east
 * longitudes. Every discount's position lies inside it: the app's own (`src/data/discounts.ts`, held to it by their
 * test) and a student's pin, which the database checks against the same numbers
 * (supabase/migrations/20261111151901_discount_positions.sql; `regensburg-box.test.ts` holds the two together). A place
 * outside it is a question for Roshan, never a reason to widen the box.
 */
export const REGENSBURG_BOX = { south: 48.97, north: 49.07, west: 12.0, east: 12.2 } as const;
