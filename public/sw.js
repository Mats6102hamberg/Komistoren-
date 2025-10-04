// Service Worker för PWA
const CACHE_NAME = 'kompistoren-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
  '/manifest.json'
];

// Installation - cacha viktiga resurser
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache öppnad');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Aktivering - rensa gamla cachar
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Raderar gammal cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Network First strategi för API-anrop, Cache First för statiska resurser
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API-anrop: Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cacha inte API-svar för bildanalys (för stora)
          return response;
        })
        .catch((error) => {
          console.error('API-anrop misslyckades:', error);
          return new Response(
            JSON.stringify({ error: 'Ingen internetanslutning' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Statiska resurser: Cache First
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Cacha inte om det inte är en lyckad respons
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Background Sync för offline-funktionalitet
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-templates') {
    event.waitUntil(syncTemplates());
  }
});

async function syncTemplates() {
  // Implementera synkronisering av mallar när anslutningen återställs
  console.log('Synkroniserar mallar...');
}

// Push notifications (valfritt för framtida funktioner)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Ny notifikation från Kompistören',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('Kompistören', options)
  );
});
