// Tumara Service Worker — Passive Safe Mode
// Membersihkan stale caches untuk mencegah OOM / IPC deadlock di iOS WebKit & Chrome Android.

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-only fetch: Tidak mengintersepsi chunk JS / API agar hash Vercel selalu sinkron
self.addEventListener("fetch", () => {});
