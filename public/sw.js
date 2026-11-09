// StudentsBudget service worker: lets the installed app open with no network. Hand-written, no library.
// The page registers it as /sw.js?v=<commit of the build>. A new commit is a new script URL, so the browser
// installs a new worker, which fills a cache of its own; once it is active it deletes the older ones. Nothing is
// bumped by hand: the version follows the commit.
// The documents are written to the cache once, on install, and never again. They are static within a build, and a
// document from a later build names chunks this build's cache does not hold, so a copy saved at runtime could
// leave the next offline open blank.
const PREFIX = 'studentsbudget-';
const CACHE = PREFIX + (new URL(self.location.href).searchParams.get('v') || 'unversioned');

// How long a page waits for the network before the cached copy is shown instead.
const NAVIGATION_TIMEOUT_MS = 4000;

// Every route document. They are cached on install, so a page nobody has opened yet still opens offline.
const PAGES = [
  '/',
  '/entries',
  '/entries/new',
  '/charts',
  '/tips',
  '/badges',
  '/check-in',
  '/reveal',
  '/ask',
  '/settings',
  '/settings/accounts',
  '/settings/plan',
  '/settings/profile',
  '/settings/appearance',
  '/settings/account',
  '/settings/backup',
  '/settings/import',
  '/settings/moderation',
  '/settings/reminder',
  '/setup',
  '/start',
  '/start/new-account',
  '/start/sign-in',
];

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
      const older = names.filter((name) => name.startsWith(PREFIX) && name !== CACHE);
      await Promise.all(older.map((name) => caches.delete(name)));
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

// The weekly reminder (docs/superpowers/plans/2026-11-05-weekly-reminder.md): the scheduled sender pushes
// { title, body, url, lang }, encrypted, and this shows it. A push that can't be read still shows the app's name: a
// push the worker leaves without a notification can cost the site its permission. One tag, so a reminder replaces an
// older one still in the tray instead of stacking.
const REMINDER_TAG = 'weekly-reminder';
const REMINDER_URL = '/check-in';

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = (event.data && event.data.json()) || {};
  } catch {
    // Not JSON: the app's name and the check-in still show.
  }
  const title = typeof message.title === 'string' && message.title !== '' ? message.title : 'StudentsBudget';
  const options = {
    body: typeof message.body === 'string' ? message.body : '',
    icon: '/icon-192.png',
    tag: REMINDER_TAG,
    data: { url: ownPath(message.url) ?? REMINDER_URL },
  };
  if (typeof message.lang === 'string') options.lang = message.lang;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = ownPath(event.notification.data && event.notification.data.url) ?? REMINDER_URL;
  event.waitUntil(
    (async () => {
      // An open window of the app is brought forward and taken to the check-in; otherwise a new one opens there.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(url);
      await open.focus();
      if (typeof open.navigate === 'function') await open.navigate(url).catch(() => undefined);
    })(),
  );
});

/** A path on this app ('/check-in'), whatever a message names: never another site. Null for anything else. */
function ownPath(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}

/** Only a plain answer is worth keeping: not an error page, not a redirect, not another origin's. */
function cacheable(response) {
  return response.ok && response.type === 'basic' && !response.redirected;
}

/**
 * Caches the pages (all required: one failing fails the install), then the files they name and the fonts those
 * stylesheets name (best effort: none of these may fail the install).
 */
async function precache() {
  const cache = await caches.open(CACHE);
  const files = new Set(FILES);

  await Promise.all(
    PAGES.map(async (path) => {
      const response = await fetch(path, { cache: 'reload' });
      if (!cacheable(response)) throw new Error(`Could not cache ${path}: status ${response.status}`);
      await cache.put(path, response.clone());
      for (const [file] of (await response.text()).matchAll(STATIC_URL)) files.add(file);
    }),
  );

  const fonts = new Set();
  await Promise.all(
    [...files].map(async (file) => {
      const response = await addFile(cache, file);
      if (!response || !file.endsWith('.css')) return;
      try {
        for (const [, ref] of (await response.text()).matchAll(CSS_URL)) {
          // A reference is relative to its stylesheet: ../media/<name>.woff2.
          const url = new URL(ref, new URL(file, self.location.origin));
          if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) fonts.add(url.href);
        }
      } catch {
        // A stylesheet that cannot be read: the fonts it names are skipped.
      }
    }),
  );
  await Promise.all([...fonts].map((font) => addFile(cache, font)));
}

/** Best effort: fetches one file into the cache. Resolves the response, or null when anything went wrong. */
async function addFile(cache, file) {
  try {
    const response = await fetch(file);
    if (!cacheable(response)) return null;
    await cache.put(file, response.clone());
    return response;
  } catch {
    return null;
  }
}

/** What the cache holds for this request, or undefined. A cache that cannot be opened is a cache without it. */
async function lookup(request, options) {
  try {
    const cache = await caches.open(CACHE);
    return await cache.match(request, options);
  } catch {
    return undefined;
  }
}

/**
 * Keeps a copy of a static file without making anyone wait for it, or fail because of it (a full disk, say).
 * Only for files: documents are never saved here (see the top of this file).
 */
function save(event, key, response) {
  // Cloned now, before the page starts reading the original.
  const copy = response.clone();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.put(key, copy);
      } catch {
        // Not saved: the next online visit tries again.
      }
    })(),
  );
}

/**
 * Network first, so an online visit gets the newest page, but not at any price: after NAVIGATION_TIMEOUT_MS the
 * cached page of that path is shown instead (whatever the query string), and without one the wait goes on.
 * A network failure, as in airplane mode, shows the cached page at once. The answer is never saved: the cached
 * page is the one this build's install stored, and an answer that arrives after the fallback may come from a
 * newer build, whose chunks this cache does not hold.
 */
async function openPage(event, url) {
  const network = fetch(event.request);

  const tooSlow = Symbol('too slow');
  let timer;
  try {
    const first = await Promise.race([
      network,
      new Promise((resolve) => {
        timer = setTimeout(resolve, NAVIGATION_TIMEOUT_MS, tooSlow);
      }),
    ]);
    if (first !== tooSlow) return first;
  } catch (error) {
    const cached = await lookup(url.pathname, { ignoreVary: true });
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return (await lookup(url.pathname, { ignoreVary: true })) ?? network;
}

/** Cache first: these files are named by a hash or never change. */
async function cacheFirst(event, ignoreSearch) {
  const cached = await lookup(event.request, { ignoreSearch });
  if (cached) return cached;
  const response = await fetch(event.request);
  if (cacheable(response)) save(event, event.request, response);
  return response;
}
