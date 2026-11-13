// Offline support: the app, lessons and handwriting data are cached on first visit.
// Bump VERSION when shipping changes so old caches are cleared.
const VERSION = 'hsk1-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'css/app.css',
  'js/main.js', 'js/ui.js', 'js/store.js', 'js/data.js', 'js/audio.js',
  'js/exercises.js', 'js/review.js', 'js/write.js',
  'vendor/hanzi-writer/hanzi-writer.min.js',
  'data/course.json',
];
const HAN = /[一-鿿]/g;

async function precache() {
  const cache = await caches.open(VERSION);
  await cache.addAll(SHELL);
  // Lessons and the stroke data for every character they use.
  const course = await (await cache.match('data/course.json')).json();
  const files = course.lessons.filter((l) => l.file).map((l) => `data/${l.file}`);
  await cache.addAll(files);
  const chars = new Set();
  for (const f of files) {
    const lesson = await (await cache.match(f)).json();
    for (const w of lesson.vocab || []) for (const c of w.hanzi.match(HAN) || []) chars.add(c);
  }
  await Promise.all([...chars].map((c) => cache.add(`vendor/hanzi-data/${c}.json`).catch(() => {})));
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Audio uses range requests; let the browser handle it directly.
  if (url.pathname.endsWith('.mp3') || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    // Network first for the page itself, cached copy when offline.
    e.respondWith(fetch(req).catch(async () => (await caches.match('index.html')) || Response.error()));
    return;
  }

  // Everything else (app files, lessons, fonts, CDN stroke data):
  // answer from cache, refresh in the background.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    return (await network) || Response.error();
  })());
});
