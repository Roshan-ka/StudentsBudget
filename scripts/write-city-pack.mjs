// Writes supabase/functions/_shared/ai/city-pack.ts, the Regensburg data the AI may quote and the app categories, from
// src/data (the AI phase, chunks 8 and 11, docs/superpowers/plans/2026-11-09-ai-phase-1.md). Run
// `node scripts/write-city-pack.mjs` after changing src/data: src/features/ai/server/city-pack.test.ts fails while the
// file is stale. Node 24 runs the .ts modules directly (type stripping).

import { writeFileSync } from 'node:fs';
import { buildCategories, buildCityPack, cityPackFile } from '../src/features/ai/server/city-pack-build.ts';

const path = 'supabase/functions/_shared/ai/city-pack.ts';
const items = buildCityPack();
const categories = buildCategories();
writeFileSync(path, cityPackFile(items, categories));
console.log(`Wrote ${items.length} items and ${categories.length} categories to ${path}.`);
