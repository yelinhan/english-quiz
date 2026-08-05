// 앱 셸 cache-first, data/*.json network-first
const CACHE = 'chunky-v15';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/home.js',
  'js/store.js',
  'js/srs.js',
  'js/quiz.js',
  'js/cloze.js',
  'js/writing.js',
  'js/ai.js',
  'js/picker.js',
  'js/lessons.js',
  'js/tutor.js',
  'js/browse.js',
  'js/stats.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // 단어장/수업 데이터는 network-first (업데이트 즉시 반영)
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 나머지는 cache-first
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
    )
  );
});
