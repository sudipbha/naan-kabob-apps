// Offline shell for the NK Champion tracker.
// index.html updates flow through automatically (network-first);
// bump CACHE only when vendored JS / icon / manifest / SW logic change.
const CACHE_PREFIX = "nk-champion-";
const CACHE = CACHE_PREFIX + "v1";
// NOTE: never precache the Tailwind CDN URL — addAll is atomic and an
// unreachable CDN would fail the whole install. It is runtime-cached below.
const PRECACHE = [
  "./",
  "./index.html",
  "./react.production.min.js",
  "./react-dom.production.min.js",
  "./icon-180.png",
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
        // prefix-filtered: on GitHub Pages both apps share one origin,
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
  // ignoreSearch: legacy home-screen URLs may still carry a ?r= cache-bust param
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  // opaque: the Tailwind CDN script is a classic no-cors script (ok is always false)
  if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isNav = req.mode === "navigate" || req.destination === "document";
  if (isNav && url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  const scopePath = new URL("./", location.href).pathname;
  if (url.origin === location.origin && url.pathname.startsWith(scopePath)) { e.respondWith(cacheFirst(req)); return; }
  if (url.hostname === "cdn.tailwindcss.com") { e.respondWith(cacheFirst(req)); return; }
  // everything else (Supabase REST, other cross-origin) goes straight to network
});
