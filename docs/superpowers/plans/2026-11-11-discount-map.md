# Discount map (11-11-2026)

## Context

The community plan is done (#200–#207). Roshan picked the **discount map** next: the Regensburg student discounts on a map, "similar map configuration like Too Good To Go".

Today Tips → Discounts is a list only:
- the app's 17 sourced discounts (`src/data/discounts.ts`);
- signed in, also the discounts students add (`community_discounts_feed`).

Nothing has coordinates. The repo has no map library, no geolocation use and no CSP.

**What it should feel like:** a student in town opens Discounts and switches to Map. They see pins around them, tap one and get the discount's card at the bottom, as in Too Good To Go. "Show me" centres the map on them and says how far each discount is.

The plan is copied into `docs/superpowers/plans/2026-11-11-discount-map.md` in chunk 1.

## Decided (Roshan, 11-11-2026)

- **Map source:** a map of Regensburg built from OpenStreetMap and shipped inside the app.
  - There is no outside tile service, so nobody outside sees a student's IP or location.
  - It works offline after the first map open, and needs no new privacy note.
- **Students' discounts:** an optional pin chosen in the Add a discount form. Without one, a discount shows in the list only. This needs a migration.
- **Location:** "Show me" asks for the phone's location only on a tap.
  - The position stays on the phone, in memory only, never stored or sent.
  - The map centres on it, and each discount shows its distance.

## Design (my calls, after a review of the code; open to objection)

### Tiles, style and the map library
- **Tiles:** `scripts/build-map-tiles.mjs` (dev dependency `pmtiles`) reads a Protomaps OpenStreetMap build with range requests, for the Regensburg box. The box is about 12.00–12.20 E, 48.97–49.07 N, up to zoom 15, which is about 430 tiles.
  - It writes uncompressed `z/x/y.pbf` files to `public/maps/<set>/regensburg/`. There is no Go binary and no Range requests at runtime.
  - The set id (the build date) is in every path, and the build's URL and date are kept as a data constant.
  - Running it downloads data, so I ask Roshan first with the size.
  - **Size budget:** a few MB. If it's over, maxzoom drops to 14 and MapLibre stretches the tiles for closer zooms.
  - **`.gitattributes`:** `public/maps/** binary`.
- **Style:** built in JS from `@protomaps/basemaps` (no `style.json`), in a light and a dark flavour that follow the app's theme. The glyphs and sprites are self-hosted under `/maps/<set>/`.
  - Every URL is absolute (from `location.origin`), since tiles load in a blob worker.
  - A unit test checks that the style names only `/maps/` URLs (the package defaults its glyphs to an outside host).
  - The source has `bounds`, `minzoom` and `maxzoom`, and the map has `maxBounds`, so nothing outside the set is requested.
- **`maplibre-gl`:**
  - **How it loads:** its built JS and CSS are copied to `/maps/vendor/maplibre-gl-<version>.js|.css` and loaded by a script and link tag, with types from `import type`.
  - **Why:** a lazily imported chunk would sit in the per-commit cache and die offline after every deploy.
  - **Test:** the copied version must equal `package.json`'s.
- **Licences:** the ODbL notice and the Noto glyphs' OFL ship next to the tiles. The map shows "© OpenStreetMap contributors · Protomaps" as our own line, linked, with `attributionControl: false`.

### Offline (`public/sw.js`, `src/lib/sw-register.ts`)
- **Its own cache:** maps get `studentsbudget-map-<set>`.
  - The worker is registered as `/sw.js?v=…&map=<set>`.
  - `activate` keeps that cache when it cleans the per-commit ones, and drops older map sets.
- **Serving:** `lookup` and `save` take a cache name, and a `/maps/` branch serves cache-first, saving as viewed.
- **To check in the trial run:** whether the worker sees tile requests from MapLibre's blob worker, in `offline.spec` (Chromium) and on Roshan's iPhone. If it doesn't, the tiles load through `maplibregl.addProtocol`, whose loader runs on the main thread.

### Positions
- **The app's 17:** `Discount` gains an optional `location: { lat, lng, source: 'OpenStreetMap', url, checked }`.
  - Every bundled discount gets one, looked up on openstreetmap.org with its node or way URL, as every city number keeps a source.
  - **Data test:** each position lies inside the box, with an https openstreetmap.org URL and a real date.
  - **Left out:** the MCP server and the city pack ignore the field.
- **The box:** kept in one TypeScript constant, whose test reads it from the migration, as `checkDiscount` does.

### The view (Tips → Discounts)
- **Build flag:** `mapInBuild()` (`NEXT_PUBLIC_DISCOUNT_MAP=1`), like `aiInBuild()`. It's set in the e2e build and on Vercel previews, and in Production after the real try. Until then nobody sees an unapproved look.
- **List/Map switch:** a `SegmentedControl` (`src/features/charts/chart-parts.tsx:282`), remembered as `studentsbudget-discounts-view` (`useChoicePref`, `src/lib/phone-pref.ts`; a new key in CLAUDE.md). The category chips filter both views.
- **Mounting:** `DiscountMap` is mounted only while the Discounts tab is chosen and Map is on (`tips-view.tsx:39`).
  - Its effect creates the map, and its cleanup calls `map.remove()`, so no WebGL context leaks when the page hides.
  - The camera, the chosen pin and the category live in `DiscountsView`.
- **Pins:**
  - Each pin is our own `<button>`, either inside a marker wrapper with MapLibre's "Map marker" label removed, or positioned with `map.project`.
  - It shows the category icon on its tint (`categoryTint`, `CATEGORY_ICONS`), outlined, at least 44 px, named "Place: offer".
  - A tap focuses it. Discounts at one spot share a pin with a count (Haidplatz 8 has two).
  - A student's pin is marked as a student's, and the chosen pin shows by shape too, not colour alone.
- **Controls:** our own "+", "−" and "Show all" buttons (WCAG 2.5.1 and 2.5.7). `cooperativeGestures`, or a map box short enough to scroll past. The canvas's label is translated through MapLibre's `locale` option.
- **Card at the bottom:** a summary card, not the list's card, since ids and vote focus would clash.
  - **Contents:** tag, place, offer, address, distance and freshness.
  - **"Show in the list":** switches to the list and focuses the discount's heading, as the checklist's "See the tip" does (`tips-view.tsx:44–49`).
  - **Focus:** it opens on its heading, and Escape or Close hands the focus back to the pin (`useFocusAfter`, `src/lib/focus.ts`).
- **No WebGL:** a line says the map can't show on this phone and the list has every discount.
- **`tokens.test.ts`:** the pin outline and the location dot at 3:1 against the Protomaps light and dark colours.

### Show me
- **On tap only:** `navigator.geolocation.getCurrentPosition`, then a "you are here" dot and the map centred on it.
- **Distances:** on the card and on the list's items, from a pure `distanceMeters` (haversine), formatted per language.
- **Messages:** for denied, unavailable, and outside Regensburg (the map stays on the city).
- **Hidden** where `navigator.geolocation` is missing.

### Students' pins
- **Migration:**
  - nullable `lat` and `lng` on `community_discounts`, both or neither, inside the box;
  - the 7-argument `post_discount` dropped and a 9-argument one created (`p_lat`, `p_lng` default null);
  - `community_discounts_feed` dropped and created with `lat` and `lng` after `mine`;
  - grants re-run; `discount_queue` unchanged.
  - The applied migration `20261111101604` is never edited; both are pushed together before the deploy that sends `p_lat`.
- **pgTAP:** `community_discounts.test.sql` follows (the signature, the feed shape, the plan count), with tests for both-or-neither, the box, and the old signature being gone.
- **The app:**
  - `studentDiscountOf` reads the position;
  - `addDiscount` (`add-discount.ts:107`) and the mock (`e2e/helpers/supabase.ts`) send it;
  - the form's optional "Place it on the map" opens a crosshair picker that also works by keyboard, with "Remove the pin".

### e2e
- **`e2e/discount-map.spec.ts`**, under `/tips` in `affected-map.json`:
  - It waits on `data-map-ready` (set on MapLibre's `load`), with the first `fitBounds` unanimated.
  - It checks pins by role and name, never canvas pixels, and mostly presses Enter on pins (old-town pins overlap).
  - It skips where `getContext('webgl2')` is null, and checks the no-WebGL line with a stubbed `getContext`.
  - **Geolocation:** `test.use({ permissions, geolocation })` and `setGeolocation`, with denied and unavailable stubbed by `addInitScript`.
  - **axe:** runs inside the spec with Map chosen, light and dark (`axe.spec` sees only default tabs).
- **Offline checks:** in `e2e/offline.spec.ts`, since the main config blocks service workers.

## Chunks (about 1 h each, a draft PR each, CI on Roshan's OK)

1. **Trial run:** the plan into `docs/`, the tile script and set (after Roshan's OK to download), glyphs, sprites and the vendor copy, a bare map behind the flag and switch, and the worker's map branch with an `offline.spec` case.
   - **Measure and report:** the size, the file count, the JS size, WebGL in both CI projects (one CI run, on his OK), whether the worker sees tile requests, and MapLibre's marker attributes.
   - **Then decide:** the maxzoom and the tile loading.
2. **Mockups** for Roshan's approval, built on real map screenshots: light and dark, 375 px, English and German. They show the switch, pins (grouped, a student's, chosen), the bottom card, Show me with a distance, and the form's picker.
3. **The 17 positions** with their OpenStreetMap sources and the data test. It can run beside chunk 2.
4. **The map view:**
   - the switch, mounting, pins and grouping, the category filter;
   - attribution, +/− and Show all, and the no-WebGL line;
   - texts in four languages, the spec and axe.
5. **The bottom card:** focus in and out, Escape, "Show in the list", and the spec.
6. **Show me and distances,** with the spec.
7. **Students' pins, the database:** the migration, pgTAP and the box test.
8. **Students' pins in the app:**
   - the feed's position, their pins, and the form's crosshair picker;
   - the mock and the spec;
   - the CLAUDE.md rule (flag, key, offline map cache, outgoing requests: none new), and the plan's As built.

## Verification

- **Each chunk:** lint, typecheck and the touched unit tests locally; e2e and pgTAP through CI on Roshan's OK. There is no heavy lane when CI can run the check.
- **Real try on the phone** (a Vercel preview, then live with the flag on):
  - Switch to Map: the pins show, and a tap opens the card. "Show in the list" lands on the discount.
  - Show me asks once, centres the map and shows distances.
  - After one visit, and after a new deploy, airplane mode still shows the map.
  - A discount added with a pin shows on another account's map.
- **Go-live:**
  - `npx supabase db push` for chunk 7's migration;
  - `NEXT_PUBLIC_DISCOUNT_MAP=1` on Vercel Production.

## As built

- **Chunk 1** (11-11-2026), the trial run:
  - **Packages:** `maplibre-gl` 6.16.0 and `pmtiles` 4.5.0 (dev), `@protomaps/basemaps` 5.7.2 (runtime: the style is built in the browser).
  - **The set** (`MAP_SET`, `src/features/discounts/map/map-set.ts`; `scripts/build-map-tiles.mjs`, 51 s):
    - Zooms 10–15 came to 404 tiles and 9.55 MB, 6.7 MB of it at zoom 15. So the set stops at **zoom 14**: 119 tiles, 3.9 MB, stretched by MapLibre for closer zooms.
    - The fonts (3 Noto Sans faces, 5 ranges), the light and dark sprites, and the licences add 24 files and 1.35 MB. That makes `public/maps/20261110/` 5.3 MB.
    - `*.pbf` is binary in `.gitattributes`, and `public/maps/**` is ignored by ESLint.
  - **MapLibre 6 ships ES modules only**, not the global script the plan assumed.
    - `scripts/copy-map-vendor.mjs` copies `maplibre-gl.mjs` (1.08 MB), `maplibre-gl-worker.mjs` (507 KB), the CSS (70 KB) and the licence to `public/maps/vendor/maplibre-gl-6.16.0/`.
    - `loadMapLibre` imports the module with `import(/* webpackIgnore: true */ …)` (Next 16's Turbopack docs) and links the CSS.
    - The module starts its worker from the file beside it: same origin, so a worker the service worker can control. A blob is made only for a cross-origin URL.
  - **Markers:** MapLibre sets "Map marker" only on an element without an `aria-label`, and a role only on its default marker. So our own named `<button>` can be the marker element (chunk 4).
  - **The style** (`style.ts`): every URL under `${origin}/maps/<set>/`, with the source's bounds and zooms (tested in `style.test.ts`). `map-vendor.test.ts` holds the copy to package.json and checks the set's files and licences.
  - **The view, behind `mapInBuild()`** (`NEXT_PUBLIC_DISCOUNT_MAP=1`, set in `E2E_SUPABASE_ENV`):
    - a List/Map `SegmentedControl` (`studentsbudget-discounts-view`);
    - `DiscountMap`, mounted only while the Discounts tab shows (`active` from `TipsView`) and removed in its cleanup, in light or dark after the page's `dark` class, with `cooperativeGestures`;
    - our own attribution line, the no-WebGL line, and texts in four languages.
  - **Offline:** `sw.js?v=…&map=<set>` (`registerServiceWorker`'s `mapSet`); `/maps/` is served cache-first from `studentsbudget-map-<set>`, which `activate` keeps.
  - **e2e:**
    - `discount-map.spec.ts`: the map draws with no request outside the origin, the switch is remembered, and with no WebGL 2 the line shows. It records `webgl2` as an annotation.
    - `offline.spec.ts`: the map's cache holds tiles and MapLibre after one online visit, and the map draws again offline.
  - **Still to measure in CI:** WebGL 2 in the `iphone` (WebKit) project, and whether the worker saw the tile requests (the offline case).
