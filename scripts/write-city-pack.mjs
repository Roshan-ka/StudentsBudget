// Writes supabase/functions/_shared/ai/city-pack.ts, the Regensburg data the AI may quote, from src/data (the AI
// phase, chunk 8, docs/superpowers/plans/2026-11-09-ai-phase-1.md). Run `node scripts/write-city-pack.mjs` after
// changing src/data: src/features/ai/server/city-pack.test.ts fails while the file is stale. Node 24 runs the .ts
// modules directly (type stripping).

import { writeFileSync } from 'node:fs';
import { buildCityPack, cityPackFile } from '../src/features/ai/server/city-pack-build.ts';

const path = 'supabase/functions/_shared/ai/city-pack.ts';
const items = buildCityPack();
writeFileSync(path, cityPackFile(items));
console.log(`Wrote ${items.length} items to ${path}.`);
