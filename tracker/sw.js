/* Fuel & Frame — offline shell.
   The page is one self-contained file, so the cache holds four things.
   Network first for the page (a new build lands on the next load), cache
   first for the icons. Your entries live in localStorage, not here.      */
const CACHE = "fuelframe-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png",
               "./icons/maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if(req.mode === "navigate" || req.destination === "document"){
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone();
                       caches.open(CACHE).then(c => c.put("./index.html", copy));
                       return res; })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./"))));
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
    return res;
  })));
});
