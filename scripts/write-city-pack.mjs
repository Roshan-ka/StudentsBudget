// Writes supabase/functions/_shared/ai/city-pack.ts, the Regensburg data the AI may quote and the app categories, from
// src/data and src/i18n (the AI phase, chunks 8 and 11, docs/superpowers/plans/2026-11-09-ai-phase-1.md; each item's
// words since the Groq switch, chunk 3, docs/superpowers/plans/2026-11-13-groq-free-plan.md). Run
// `node scripts/write-city-pack.mjs` after changing src/data, src/i18n/city or the category names:
// src/features/ai/server/city-pack.test.ts fails while the file is stale. Node 24 runs the .ts modules directly (type
// stripping); the city words import without extensions, so the app's imports are registered before the builder loads.

import { writeFileSync } from 'node:fs';
import { registerAppImports } from '../mcp/app-imports.ts';

registerAppImports();
const { buildCategories, buildCityPack, cityPackFile } = await import('../src/features/ai/server/city-pack-build.ts');

const path = 'supabase/functions/_shared/ai/city-pack.ts';
const items = buildCityPack();
const categories = buildCategories();
writeFileSync(path, cityPackFile(items, categories));
console.log(`Wrote ${items.length} items and ${categories.length} categories to ${path}.`);
