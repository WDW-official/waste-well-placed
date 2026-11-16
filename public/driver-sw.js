/* Only cache the offline notice. Customer data, documents and APIs stay network-only. */
const offlineCache = "wwp-driver-offline-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(offlineCache)
      .then((cache) => cache.add("/driver-offline.html")),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.mode === "navigate" &&
    url.origin === self.location.origin &&
    url.pathname.startsWith("/driver")
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/driver-offline.html")),
    );
  }
});
