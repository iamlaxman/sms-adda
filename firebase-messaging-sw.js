// firebase-messaging-sw.js
// Firebase Cloud Messaging Service Worker for SMS Adda
// Project: nepchat-aac9d

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyCoKAoarWlu8B6cnIw549hfg_UPe8YRSko",
  authDomain: "nepchat-aac9d.firebaseapp.com",
  databaseURL: "https://nepchat-aac9d-default-rtdb.firebaseio.com",
  projectId: "nepchat-aac9d",
  storageBucket: "nepchat-aac9d.firebasestorage.app",
  messagingSenderId: "179485804786",
  appId: "1:179485804786:web:3ec8a2fc563b08c682286b"
});

// Initialize messaging
const messaging = firebase.messaging();

// ===== HANDLE BACKGROUND MESSAGES =====
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM-SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'SMS Adda';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon/favicon-192x192.png',
    badge: '/favicon/favicon-96x96.png',
    image: payload.fcmOptions?.image || undefined,
    data: {
      url: payload.data?.click_action || '/chat.html',
      type: payload.data?.type || 'message',
      ...(payload.data || {})
    },
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : [],
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'sms-adda',
    renotify: true,
    requireInteraction: payload.data?.requireInteraction === 'true',
    silent: false,
    timestamp: Date.now()
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ===== HANDLE NOTIFICATION CLICK =====
self.addEventListener('notificationclick', function(event) {
  console.log('[FCM-SW] Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/chat.html';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window open with this URL
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ===== HANDLE NOTIFICATION CLOSE =====
self.addEventListener('notificationclose', function(event) {
  console.log('[FCM-SW] Notification closed:', event);
  // Optional: analytics tracking
});

// ===== INSTALL EVENT =====
self.addEventListener('install', function(event) {
  console.log('[FCM-SW] Service Worker installed');
  self.skipWaiting();
});

// ===== ACTIVATE EVENT =====
self.addEventListener('activate', function(event) {
  console.log('[FCM-SW] Service Worker activated');
  event.waitUntil(clients.claim());
});

console.log('[FCM-SW] Firebase Messaging Service Worker loaded');