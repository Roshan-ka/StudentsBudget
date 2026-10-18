// StudentsBudget service worker: lets the installed app open with no network. Hand-written, no library.
// Change CACHE whenever the list of pages or the strategies below change: a new name starts a fresh cache
// and the old one is deleted on activate.
const CACHE = 'studentsbudget-v1';

// Every route document. They are cached on install, so a page nobody has opened yet still opens offline.
const PAGES = ['/', '/entries', '/entries/new', '/charts', '/check-in', '/reveal', '/settings', '/setup'];

// Files that keep their name. They are looked up ignoring the query string, because Next links the favicon and
// the apple icon as `/favicon.ico?favicon.<hash>.ico`.
const FILES = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-icon.png', '/favicon.ico'];

// The hashed scripts and styles a page names in its HTML, in its tags and in its inlined flight data.
const STATIC_URL = /\/_next\/static\/[^"'\\\s)<>]+/g;

// What a stylesheet names with url(): the fonts, which the HTML does not mention.
const CSS_URL = /url\(\s*["']?([^"')\s]+)["']?\s*\)/g;

self.addEventListener('install', (event) => {
  // Take over without waiting for old pages to close, so the very first visit is controlled too.
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only our own GETs. Everything else (api.frankfurter.dev, any POST) goes to the network untouched.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Other navigations, such as the calendar file the check-in links to, are not ours.
    if (PAGES.includes(url.pathname)) event.respondWith(openPage(event, url));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event, false));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(cacheFirst(event, true));
  }
  // Nothing else is answered here. That includes the RSC requests of Next's client-side taps: offline they
  // fail, Next then opens the page as an ordinary navigation, and `openPage` answers that.
});

/**
 * Caches the pages (all required), then the files they name, and the fonts those stylesheets name. The files are
 * best effort: one failing must not fail the install.
 */
async function precache() {
  const cache = await caches.open(CACHE);
  const files = new Set(FILES);

  await Promise.all(
    PAGES.map(async (path) => {
      const response = await fetch(path, { cache: 'reload' });
      if (!response.ok) throw new Error(`Could not cache ${path}: status ${response.status}`);
      await cache.put(path, response.clone());
      for (const [file] of (await response.text()).matchAll(STATIC_URL)) files.add(file);
    }),
  );
  await Promise.all([...files].map((file) => cache.add(file).catch(() => undefined)));

  const fonts = new Set();
  await Promise.all(
    [...files]
      .filter((file) => file.endsWith('.css'))
      .map(async (file) => {
        const stylesheet = await cache.match(file);
        if (!stylesheet) return;
        for (const [, ref] of (await stylesheet.text()).matchAll(CSS_URL)) {
          // A reference is relative to its stylesheet: ../media/<name>.woff2.
          const url = new URL(ref, new URL(file, self.location.origin));
          if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) fonts.add(url.href);
        }
      }),
  );
  await Promise.all([...fonts].map((font) => cache.add(font).catch(() => undefined)));
}

/** Saves a copy without making the response wait for it, or fail because of it (a full disk, say). */
function save(event, cache, key, response) {
  event.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
}

/** Network first, so an online visit always gets the newest page. Offline: the cached page of that path, whatever the query. */
async function openPage(event, url) {
  const cache = await caches.open(CACHE);
  let response;
  try {
    response = await fetch(event.request);
  } catch (error) {
    const cached = await cache.match(url.pathname, { ignoreVary: true });
    if (cached) return cached;
    throw error;
  }
  // Keeps the cached page current. A page with a query is not stored: it would replace the plain one.
  if (response.ok && !url.search) save(event, cache, url.pathname, response);
  return response;
}

/** Cache first: these files are named by a hash or never change. */
async function cacheFirst(event, ignoreSearch) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request, { ignoreSearch });
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok) save(event, cache, event.request, response);
  return response;
}
