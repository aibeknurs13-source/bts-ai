const CACHE = 'bts-ai-v2';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

/** App shell — always fetched from network so a redeploy is picked up immediately. */
const isShell = (url) =>
  url.pathname.endsWith('/') ||
  url.pathname.endsWith('/index.html') ||
  url.pathname.endsWith('/sw.js') ||
  url.pathname.endsWith('/manifest.webmanifest');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Навигация и оболочка приложения: network-first.
  // Раньше здесь был cache-first, из-за чего после обновления сборки браузер
  // держал старый index.html и не мог загрузить новые чанки с хешами в имени.
  if (req.mode === 'navigate' || isShell(url)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // Файлы в /assets/ иммутабельны (в имени хеш сборки) — cache-first.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
