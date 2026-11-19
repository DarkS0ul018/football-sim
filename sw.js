// ===== SERVICE WORKER: игра работает без интернета =====
// При установке скачивает всё, что подключает index.html (скрипты, стили), иконки и манифест.
// Дальше: «сначала свежая версия с сервера, без сети — из кэша» — изменения видны сразу,
// а без интернета игра всё равно запускается.

const CACHE = 'football-sim-v2';
const EXTRA = ['./', 'index.html', 'manifest.webmanifest',
    'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // Список файлов берём прямо из index.html — не нужно поддерживать его вручную
        const html = await (await fetch('index.html', { cache: 'no-store' })).text();
        const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
        await cache.addAll([...new Set([...EXTRA, ...refs])].map(u => new Request(u, { cache: 'reload' })));
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
        // Шрифты не меняются — сразу из кэша
        if (fonts && cached) return cached;
        // Файлы игры: сначала свежая версия с сервера (мимо HTTP-кэша браузера),
        // кэш — только если сети нет или она не отвечает 4 секунды
        const network = fetch(req, sameOrigin ? { cache: 'no-cache' } : undefined).then(res => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
        }).catch(() => null);
        const timeout = new Promise(r => setTimeout(() => r(null), cached ? 4000 : 60000));
        const res = await Promise.race([network, timeout]);
        if (res) return res;
        if (cached) { event.waitUntil(network); return cached; }
        // Совсем без сети и без кэша: для страниц — главная из кэша
        if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
        return Response.error();
    })());
});
