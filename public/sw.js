/*
 * The garden, kept on her phone. After one visit everything she has seen is stored here, so the
 * next visit opens in about a second and the whole journey plays without a connection (on a
 * flight, on weak signal). Nothing here is sent anywhere: it only keeps copies of this site's
 * own files. The page (index.html) is always fetched fresh when there is a connection, so an
 * update to the site arrives on the next visit.
 */
const VERSION = 'garden-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// the page sends the files it has loaded once the garden is up: keep them all
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'warm' || !Array.isArray(d.urls)) return;
  e.waitUntil(
    caches.open(VERSION).then(async (c) => {
      for (const u of d.urls.slice(0, 400)) {
        try {
          const url = new URL(u, self.location.origin);
          if (url.origin !== self.location.origin || (await c.match(url.pathname + url.search))) continue;
          const r = await fetch(url, { credentials: 'same-origin' });
          if (r.ok) await c.put(url.pathname + url.search, r);
        } catch {
          /* offline right now: next time */
        }
      }
    }),
  );
});

const put = async (req, res) => {
  if (res && res.ok && res.type === 'basic') (await caches.open(VERSION)).put(req, res.clone());
  return res;
};
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), ms));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // the page itself: fresh when online (3 s), the kept copy when not
  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch(req).then((r) => put('/', r)), timeout(3000)]).catch(async () => (await caches.match('/')) || fetch(req)),
    );
    return;
  }
  // built files never change under the same name: the kept copy is always right
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => put(req, r))));
    return;
  }
  // everything else (the manor, the encrypted vault, the manifest): fresh when online, kept
  // copy when not
  e.respondWith(fetch(req).then((r) => put(req, r)).catch(async () => (await caches.match(req)) || Response.error()));
});
