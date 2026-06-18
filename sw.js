const CACHE_NAME = 'flowmind-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/tasks.js',
  '/js/pomodoro.js',
  '/js/ai.js',
  '/js/charts.js',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  // Only cache GET requests for static assets, not API calls
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
