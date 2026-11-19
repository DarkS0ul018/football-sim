// ===== SERVICE WORKER: игра работает без интернета =====
// При установке скачивает всё, что подключает index.html (скрипты, стили), иконки и манифест.
// Дальше: «сначала из кэша, а в фоне — свежая версия с сервера» — запуск мгновенный,
// обновления подтягиваются сами и видны при следующем открытии.

const CACHE = 'football-sim-v1';
const EXTRA = ['./', 'index.html', 'manifest.webmanifest',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // Список файлов берём прямо из index.html — не нужно поддерживать его вручную
        const html = await (await fetch('index.html', { cache: 'no-store' })).text();
        const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
        await cache.addAll([...new Set([...EXTRA, ...refs])]);
        self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
    if (!sameOrigin && !fonts) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: sameOrigin });
        const network = fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
        }).catch(() => null);
        if (cached) {
            if (sameOrigin) event.waitUntil(network); // обновляем кэш в фоне (шрифты не меняются)
            return cached;
        }
        const res = await network;
        if (res) return res;
        // Совсем без сети и без кэша: для страниц — главная из кэша
        if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
        return Response.error();
    })());
});
