// Service Worker HayBike System
//
// PERUBAHAN PENTING: strategi cache dipisah menurut jenis permintaan.
//
// Versi sebelumnya memakai cache-first untuk SEMUA permintaan GET, termasuk
// '/' dan '/index.html'. Karena Vite menyisipkan nama berkas bundel yang
// ber-hash ke dalam index.html, setiap kali aplikasi dirilis ulang peramban
// tetap menyajikan index.html lama yang menunjuk bundel yang sudah tidak ada
// di server -- gejalanya layar putih atau aplikasi mentok di versi lama
// sampai cache dibersihkan manual.
const CACHE_NAME = 'haybike-cache-v4';
const PRECACHE_URLS = ['/manifest.json', '/icon.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Jangan pernah menyentuh lalu lintas Firebase: data real-time dan token
  // otentikasi harus selalu segar, tidak boleh dilayani dari cache.
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebaseapp.com')
  ) {
    return;
  }

  // Dokumen HTML: jaringan lebih dulu, cache hanya sebagai jaring pengaman
  // ketika koneksi mati. Inilah yang membuat rilis baru langsung terpakai.
  const isDocument =
    request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Aset statis ber-hash: cache lebih dulu, aman karena namanya berubah
  // setiap kali isinya berubah.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
