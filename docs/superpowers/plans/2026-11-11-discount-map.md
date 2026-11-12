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
  - A tap focuses it. Discounts at one spot share a pin with a count (Haidplatz 8 has two), and pins close together on screen join into a count pin (The look, below).
  - A student's pin is marked as a student's, and the chosen pin shows by shape too, not colour alone.
- **Controls:** our own "+", "−" and "Show all" buttons (WCAG 2.5.1 and 2.5.7). `cooperativeGestures`, or a map box short enough to scroll past. The canvas's label is translated through MapLibre's `locale` option.
- **Card at the bottom:** a summary card, not the list's card, since ids and vote focus would clash.
  - **Contents:** tag, place, offer, address, distance and freshness.
  - **"Show in the list":** switches to the list and focuses the discount's heading, as the checklist's "See the tip" does (`tips-view.tsx:44–49`).
  - **Focus:** it opens on its heading, and Escape or Close hands the focus back to the pin (`useFocusAfter`, `src/lib/focus.ts`).
- **No WebGL:** a line says the map can't show on this phone and the list has every discount.
- **`tokens.test.ts`:** the pin outline and the location dot at 3:1 against the Protomaps light and dark colours.

### The look (Roshan approved it from mockups, round 1, 11-11-2026)
The mockups were drawn on the real map from the app's set, at 375 px, in German light and dark and in English. Every colour comes from the tokens in `globals.css`, and every icon is a lucide one.
- **Layout:** the map box fills the height from the List/Map switch to the bottom navigation (rounded, 1.5 px `--outline`, `shadow-offset`). The attribution line sits under it.
  - **Chips:** the category chips sit on the map's top edge, in a row.
  - **Zoom and Show all:** "+", "−" and "Show all" (the maximize icon) are 44 px outlined square buttons, stacked at the top-right below the chips.
  - **Show me:** a pill with the locate icon at the bottom-left. Once on, it is filled in `--primary` and reads "You're here" ("Du bist hier").
- **Pins:** 44 px and round, on the category's tint, with a 1.5 px outline, the offset shadow and the category icon.
  - **A student's pin:** a dashed 2 px outline and a small person badge.
  - **Discounts at one spot:** a count badge on the pin.
  - **The chosen pin:** a 52 px teardrop with a 2.5 px outline, pointing at the place. Its shape marks it, not its colour.
- **Count pins** (new, Roshan approved them with the look): pins closer than about 46 px on screen join into one 48 px pin in `--card`, with their count in Bricolage 800. A tap zooms in on them. The chosen pin never joins. This replaces "only discounts at one spot share a pin": in the old town, the pins overlap at city zoom.
- **The "you are here" dot:** 18 px in `--primary`, with a 3 px ring in `--card` and a 7 px halo of `--primary` at 28 %.
- **The card at the bottom:** inside the map, 10 px from its edges, rounded, outlined, with the offset shadow.
  - **Top row:** the category pill (tinted) and a 44 px round Close (×).
  - **Text:** the place (Bricolage 800), the offer (semibold), and the address (muted).
  - **Meta row:** the distance, bold with the navigation icon in `--primary`, beside "Last confirmed …".
  - **Button:** "Show in the list", full width and outlined.
- **The form's pin:** "On the map (optional)" holds a 210 px map with a needle fixed in its middle (a `--primary` pin with a `--card` dot), and the hint "Move the map until the needle is on the place."
  - **Before:** "Set the pin here" (primary).
  - **After:** "Pin set" (the map-pin icon in `--primary`) and "Remove the pin" (outlined).
- **Words** (German as approved): Liste/Karte, Mich zeigen, Du bist hier, In der Liste zeigen, „… m entfernt“, Pin hier setzen, Pin gesetzt, Pin entfernen; and in English, Show me, You're here, Show in the list, "… m away", Set the pin here, Pin set, Remove the pin.

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
  - **Measured in CI** (run 43030713043, both browsers):
    - The map draws in both projects: CI's WebKit has WebGL 2 too.
    - The offline case passed, so the worker sees MapLibre's tile requests and the map draws again offline. `addProtocol` isn't needed.
    - The spec's first check of outside requests counted the page's own first request, which leaves `about:blank`. It now compares against the configured origin.
- **Chunk 2** (11-11-2026), the mockups:
  - **Round 1:** Roshan approved it as it stood. The look is written down above ("The look").
  - **How they were made:** a throwaway page in the scratchpad that loads MapLibre, the basemap package and the set from the repo, with the 17 positions from #208 and one made-up student's discount. It was served on 127.0.0.1 only and opened in the browser pane; none of it is in the repo.
  - **Lessons for chunk 4,** from building them:
    - **Marker elements:** a marker's element must not set `position`. MapLibre places `.maplibregl-marker` absolutely, and `position: relative` on the element stacks the pins in the page flow, far off their places.
    - **The container's height:** MapLibre gives its container `position: relative`, so the container needs a height of its own. The view's `h-[60svh]` has one; an `absolute inset-0` box loses it.
    - **Zoom maths:** MapLibre's zooms count 512 px tiles, which is one level more detail than 256 px maths gives. Views are best set with `fitBounds`, not by sums.
    - **Count pins:** they need the map laid out (`load`) and are worked out again after each zoom (`moveend`), from `map.project`.
- **Chunk 3** (11-11-2026, in its own session, #208), the positions:
  - **The data:** `Discount` gains an optional `location` (`DiscountLocation`: lat, lng, `source: 'OpenStreetMap'`, url, checked), built by a small `osm()` helper.
    - All 17 were looked up through Nominatim and confirmed from each element's tags, at 5 decimals, checked 11.11.2026.
    - A node gives its own position; a way or relation gives the centre Nominatim reports.
  - **`REGENSBURG_BOX`** (`src/data/regensburg-box.ts`, 48.97–49.07 N, 12.00–12.20 E) holds every position. Chunk 7's migration checks the same numbers.
  - **`discounts.test.ts`:**
    - each position lies inside the box, at most 5 decimals;
    - it has an OSM node, way or relation URL and a real date;
    - discounts at one address share one position, and no others do.
  - **Asia Restaurant Sunrise** keeps a stand-in: OSM has neither the restaurant nor Von-Seeckt-Straße 23. It takes the street's only mapped Asian restaurant, with a comment saying so (kept as it is, Roshan, 11-11-2026).
  - **Haidplatz 8:** the Stadtbücherei and the VHS both take the Thon-Dittmer-Palais' position, so they share one pin.
- **Chunk 4** (11-11-2026, in its own session, #212, CI run 43051183877 green), the map view:
  - **Pins** (`map/pins.ts`, pure):
    - `spotsOf` groups discounts at one position into a spot, ordered north to south, then west to east, so the keyboard meets the pins as the eye does.
    - `pinsOf` joins spots closer than 46 px into a count pin; the chosen spot never joins.
    - The grouping runs on `worldPixel` (Web Mercator at MapLibre's 512 px tiles) at the zoom the map came to rest at, so pins don't part and join while it moves.
  - **Not MapLibre markers:** the pins are our own buttons in a `dir="ltr"` layer over the canvas, placed with `map.project` on every frame of a move. Pins off the screen aren't drawn, so the keyboard never reaches a hidden one.
  - **Names:** a pin is "Place: offer", a spot of several "2 discounts here: …", and a count pin "8 discounts close together: zoom in". A count pin zooms in on its spots, and the focus waits on the canvas.
  - **The view:**
    - in map mode the chips sit along the map's top edge, in one row that scrolls sideways;
    - "+", "−" and "Show all" (`fitBounds` on what is shown) sit at the top end;
    - a new category fits the map to what it shows;
    - north stays up (rotation and pitch off).
  - **Where it opens:** on every discount, or where it was left: the camera and the chosen spot live in `DiscountsView`. The box fills the screen down to the navigation (at least 18rem).
  - **MapLibre's own words** (the canvas's name, the two-finger and Ctrl-scroll hints) come in the phone's language through its `locale` option.
  - **e2e:** under reduced motion, which MapLibre honours, so each zoom has settled by the next step. Every discount is counted on the opened map through the pins' names; also count pins, the chips, zoom, the camera kept, and axe in light and dark.
- **Chunk 5** (12-11-2026, in its own session), the card at the bottom:
  - **`DiscountCard`** (`map/discount-card.tsx`) shows the chosen spot's discounts:
    - each with the list's tags (`DiscountTags`, now shared with the list), place, offer, address, freshness and "Show in the list";
    - one Close for the card;
    - Haidplatz 8's two in one card, named after its pin.
  - **Placing:** 10 px from the map's edges, in the room below the chips, scrolling when taller. A chosen pin the card or the chips would hide is moved into the room between them (`easeTo` with an offset).
  - **Focus:**
    - a tap that opens the card puts the focus on its heading (a mark, so a card shown again after the tab or page comes back doesn't take it);
    - Close, Escape or a second tap on the pin closes it, with the focus back on the pin, or on the count pin it joined;
    - "Show in the list" switches to the list and lands on the discount's heading there.
  - **Contrast:** `tokens.test.ts` holds the pin outline and the focus ring at 3:1 against every area and road fill of Protomaps' light and dark flavours, land cover included. Label colours and boundaries are left out. Measured: outline at least 4.46:1 (light) and 3.55:1 (dark); ring 3.38:1 and 4.83:1.
  - **No distance yet:** the card's meta row has only the freshness until Show me (chunk 6).
  - **Checks without an install:** lint, typecheck and the touched unit tests ran in the worktree against the main checkout's `node_modules` (Node finds them in the parent folder), with the worktree's own removed. No heavy lane for an install (Roshan, 11-11-2026).
- **Chunk 7** (11-11-2026, #211), students' pins in the database: migration `20261111151901_discount_positions.sql`.
  - **Columns:** nullable `lat` and `lng` on `community_discounts`, both or neither (`community_discounts_position_whole`), inside the box (`community_discounts_position_in_regensburg`). NaN and infinity are refused too.
  - **`post_discount`:** made again with `p_lat` and `p_lng`, both defaulting to null, so the app's seven named arguments kept working until chunk 8.
  - **`community_discounts_feed`:** made again, returning `lat` and `lng` after `mine`. `discount_queue` is unchanged.
  - **pgTAP:** 35 → 41 tests, covering the old signature gone, a pinned and an unpinned discount in the list, half a position, Munich, and just east of the box.
  - **`regensburg-box.test.ts`:** reads the box's numbers, and both-or-neither, from the migration.
- **Chunk 8** (12-11-2026), students' pins in the app:
  - **The data:** `DiscountLocation.source` is `'OpenStreetMap'` or `'student'`.
    - `inRegensburgBox` (in `regensburg-box.ts`) is the one check.
    - `studentDiscountOf` gives a discount its `location` only when the feed has both numbers inside the box, with the student's link as `url` and the day added as `checked`. Chunk 4's map then shows it as a student's pin, with no change to the view.
  - **The form:**
    - `DiscountDraft.pin` and `NewDiscount.lat`/`lng`.
    - `checkDiscount` rounds the pin to 5 decimals and refuses one outside the box (`pin`, tied to the picker's button), after the other fields.
    - `addDiscount` sends `p_lat` and `p_lng`, null without a pin.
  - **`PinPicker`** (`map/pin-picker.tsx`, behind `mapInBuild()`), after the address:
    - a 210 px map of the set with the needle fixed in its middle, opening on the old town;
    - "Set the pin here" takes the map's middle; the pin then keeps its place as the map moves, with "Pin set" and "Remove the pin";
    - a tap centres the map there, and "+" and "−" zoom, so no drag is needed (WCAG 2.5.7); the canvas takes the arrow keys and is named "Map to set the pin on";
    - without WebGL 2, a line says the discount goes without a pin.
  - **Shared helpers:** `map-theme.ts` holds the theme and WebGL hooks for the picker. `DiscountMap` keeps its own copies from chunk 4, to fold in later.
  - **Texts:** in four languages, as approved. The hint adds "or tap the place" to the approved words, for the tap.
  - **e2e:**
    - the mock stores and returns positions and refuses a half or outside one;
    - `community-discounts.spec` expects `p_lat`/`p_lng` null without a pin;
    - a new case sets, removes and sets the pin, sends it from the old town to 5 decimals, and finds the student's pin on the map behind the Shopping chip.
  - **CLAUDE.md:** a Discount map rule, the plan in the opening list, and the `studentsbudget-discounts-view` key.
- **Chunk 6** (12-11-2026, in its own session, on top of chunk 5), Show me:
  - **Asking:** `whereIs` (`map/distance.ts`) asks `navigator.geolocation` once per tap, with a fix of up to a minute ago allowed and 20 s to wait.
    - Inside the box (`inRegensburgBox`, chunk 8's) it gives the position. Outside it gives `outside`, so no distance reads in tens of kilometres.
    - A refused permission is `denied`; anything else is `unavailable`.
  - **Memory only:** the position lives in `DiscountsView`'s state, never stored or sent. A refusal or leaving the city drops it; a failed fix keeps the last one.
  - **On the map:** the pill sits just above the card (outlined, then filled in `--primary` and pressed: "You're here").
    - The dot is 18 px of `--primary` in a 3 px `--card` ring, with a 7 px halo.
    - Each find centres the map on it, at zoom 15 or closer (`centreOn`, so opening the map again doesn't jump).
    - A `StatusLine` under the map says what Show me has to say.
  - **Distances:** `distanceMeters` (haversine) and `formatDistance` (metres to the 10 below a kilometre, then kilometres to one decimal below 10, in the locale's units), as "850 m away" / "2,9 km entfernt", bold with the navigation icon, on the card's meta row and on every list item.
  - **Contrast:** `tokens.test.ts` holds the dot at 3:1 against its ring and every map fill (3.38:1 light, 4.83:1 dark at the lowest).
  - **No geolocation:** the pill isn't there.
- **Nothing over a pin** (after CI run 43191801922, where axe's `target-size` caught Show me over a count pin with the card open): the map measures the chips' row, the zoom buttons, Show me and the card (a `ResizeObserver`, again when the card or Show me comes or goes), and draws no pin whose box touches one, so none is hidden yet reachable by the keyboard. The chosen teardrop is exempt; the map keeps it above the card. The fit padding grows to 88 / 80 / 80 / 80 so a fresh view keeps every pin clear.
  - **e2e:** a find in the old town (the dot, Westbad off the screen, the Turmtheater's distance on its card, distances in the list), Munich, a refusal then a failure, and no geolocation.
