const CACHE = "ripasso-v1";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([
      "./",
      "./index.html",
      "./css/style.css",
      "./js/app.js",
      "./js/sw.js",
      "./manifest.webmanifest",
      "./data/manifest.json"
    ]);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Cache-first per tutto ciò che sta in /data (JSON), così offline funziona
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // stessa origin + cartella data
  const isData = url.pathname.includes("/data/");
  if (!isData) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const res = await fetch(event.request);
      const cache = await caches.open(CACHE);
      cache.put(event.request, res.clone());
      return res;
    } catch {
      return cached;
    }
  })());
});
