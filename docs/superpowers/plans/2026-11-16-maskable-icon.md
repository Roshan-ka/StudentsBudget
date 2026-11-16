# Maskable app icon (16-11-2026)

## Context

Android crops an installed web app's icon to the launcher's shape. Without an icon marked `maskable`, Chrome shrinks ours onto a white disc. The redesign (chunk 3) already drew `scripts/icon/icon.svg` inside the maskable safe zone (the central 80 %, on the page colour), but `src/app/manifest.ts` listed both PNGs without a `purpose`, so browsers used them as `any` only.

**Decided (Roshan, 16-11-2026):** maskable icons as the next small win, from the backlog in `2026-11-10-automatic-sync.md`. The mockup round showed today's art under each launcher crop (https://claude.ai/artifact/WfC1uzqyJyCr44mLP3eydG), and Roshan approved building it with that art.

## Approach

- No new art and no new files: maskable copies would be byte copies of today's PNGs.
- The manifest lists `icon-192.png` and `icon-512.png` twice, once with `purpose: 'any'` and once with `purpose: 'maskable'`; never `'any maskable'`.
- `src/app/manifest.test.ts` holds it: both purposes at 192 and 512, every file at its stated size, and no art outside the central circle of radius 40 % (plus 1 px) in a maskable file.

## As built (one chunk)

- **`src/app/manifest.ts`:** the four entries, with a comment pointing to the SVG and the test.
- **`src/app/manifest.test.ts`:** reads the PNGs with `sharp`, as `scripts/export-icons.mjs` does. Checked once by hand before committing: the art reaches 182.5 px from the centre at 512 (the zone is 205.8) and 68.6 at 192 (77.8).
- **Notes:** the SVG's comment and CLAUDE.md's Look say the manifest lists the art as maskable and the test holds the zone.
- **Unchanged:** the PNGs, `apple-icon.png` (iOS rounds the corners itself) and `public/sw.js`, which already precaches both PNGs.
- **Still owed:** the look on a real Android phone (reinstall the app to see it at once), in Roshan's postponed phone tries.
