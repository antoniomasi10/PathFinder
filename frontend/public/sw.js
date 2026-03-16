// Service Worker for PathFinder
// Handles push notifications, click routing, and offline caching

const CACHE_NAME = 'pathfinder-v1';
const STATIC_ASSETS = [
  '/',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, fallback to cache ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache GET requests for same-origin
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  // Skip API calls from caching
  if (request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push Notification Received ──────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'PathFinder', body: event.data.text() };
  }

  const title = data.title || 'PathFinder';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: data.image,
    data: {
      url: data.url || '/notifications',
      type: data.type,
      ...(data.data || {}),
    },
    // Group notifications of the same type
    tag: data.tag || data.type || 'default',
    // High-priority notifications stay until dismissed
    requireInteraction: data.priority === 'high',
    vibrate: [200, 100, 200],
    silent: data.silent || false,
    timestamp: Date.now(),
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || '/notifications';

  // Type-based routing when no explicit URL provided
  if (!data.url || data.url === '/notifications') {
    switch (data.type) {
      case 'FRIEND_REQUEST':
        targetUrl = data.fromUserId ? `/profile/${data.fromUserId}` : '/networking';
        break;
      case 'FRIEND_ACCEPTED':
        targetUrl = data.fromUserId ? `/profile/${data.fromUserId}` : '/networking';
        break;
      case 'NEW_MESSAGE':
        targetUrl = data.chatId ? `/chat/${data.chatId}` : '/networking';
        break;
      case 'NEW_OPPORTUNITY':
        targetUrl = data.opportunityId ? `/home` : '/home';
        break;
      case 'OPPORTUNITY_DEADLINE':
        targetUrl = '/home';
        break;
      case 'COURSE_DEADLINE':
      case 'COURSE_RECOMMENDED':
        targetUrl = data.courseId ? `/universities/course/${data.courseId}` : '/universities';
        break;
      case 'BADGE_UNLOCKED':
        targetUrl = '/profile';
        break;
      case 'POST_LIKE':
      case 'POST_COMMENT':
      case 'COMMENT_REPLY':
        targetUrl = data.postId ? `/networking` : '/networking';
        break;
      case 'GROUP_UPDATE':
        targetUrl = data.groupId ? `/chat/group/${data.groupId}` : '/networking';
        break;
      default:
        targetUrl = '/notifications';
    }
  }

  // Try to focus an existing window, otherwise open a new one
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((c) => c.navigate(targetUrl));
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Notification Dismissed ──────────────────────────────────
self.addEventListener('notificationclose', () => {
  // No-op — can add analytics here in the future
});
