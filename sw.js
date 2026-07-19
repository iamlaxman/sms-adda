// sw.js - Service Worker for SMS Adda v4.0
const CACHE_NAME = 'sms-adda-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/welcome.html',
  '/chat.html',
  '/download.html',
  '/manifest.json',
  '/favicon/favicon.svg',
  '/favicon/favicon-96x96.png',
  '/favicon/favicon-192x192.png',
  '/favicon/favicon-512x512.png',
  '/favicon/apple-touch-icon.png',
  '/favicon/favicon.ico',
  '/sounds/ringtone.mp3'
];

// ===== INSTALL =====
self.addEventListener('install', function(event) {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(function(err) {
        console.warn('[SW] Cache error (some files may be missing):', err.message);
      });
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { console.log('[SW] Deleting old cache:', key); return caches.delete(key); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ===== FETCH (Skip external resources) =====
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') return;
  
  // Skip external resources - let browser handle them directly
  if (url.hostname !== self.location.hostname) return;
  
  // Skip API calls
  if (url.pathname.startsWith('/upload') || url.pathname.startsWith('/fcm-token')) return;
  
  // Network first, cache fallback for local resources
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', function(event) {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch(e) { payload = { title: 'SMS Adda', body: event.data.text() || 'New notification' }; }
  
  const options = {
    body: payload.body || '',
    icon: '/favicon/favicon-192x192.png',
    badge: '/favicon/favicon-96x96.png',
    data: { url: payload.data?.url || '/chat.html', type: payload.data?.type || 'message', ...(payload.data || {}) },
    vibrate: [200, 100, 200],
    tag: payload.tag || 'sms-adda',
    renotify: true,
    requireInteraction: payload.requireInteraction || false,
    timestamp: Date.now()
  };
  
  event.waitUntil(self.registration.showNotification(payload.title || 'SMS Adda', options));
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/chat.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.includes(url) && 'focus' in clientList[i]) return clientList[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

console.log('[SW] Service Worker loaded - Version 4.0.0');