// Offline shell for Earmark (newsletter read-aloud).
// index.html updates flow through automatically (network-first);
// bump CACHE only when icons / manifest / SW logic change.
const CACHE_PREFIX = "nk-earmark-";
const CACHE = CACHE_PREFIX + "v2";
const PRECACHE = [
  "./",
  "./index.html",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(
        // prefix-filtered: on GitHub Pages all apps share one origin,
        // so only clean up THIS app's old caches
        ks.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3500);
    const res = await fetch(req, { signal: ctl.signal });
    clearTimeout(t);
    if (res && res.ok) cache.put("./index.html", res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match("./index.html");
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function trendingNetworkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (!res || !res.ok) throw new Error("trending fetch failed");
    await cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isNav = req.mode === "navigate" || req.destination === "document";
  if (isNav && url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  const scopePath = new URL("./", location.href).pathname;
  if (url.origin === location.origin && url.pathname === scopePath + "trending.json") {
    e.respondWith(trendingNetworkFirst(req)); return;
  }
  if (url.origin === location.origin && url.pathname.startsWith(scopePath)) { e.respondWith(cacheFirst(req)); return; }
  // everything else (article fetching via r.jina.ai / allorigins, other cross-origin)
  // goes straight to network — never cached, so articles are always fresh
});
