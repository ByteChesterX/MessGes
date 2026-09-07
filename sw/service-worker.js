// Service Worker for MessGes
// Provides caching and offline support

const CACHE_NAME = 'messges-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/themes.css',
    '/css/responsive.css',
    '/js/config.js',
    '/js/utils.js',
    '/js/main.js',
    'https://cdn.jsdelivr.net/npm/emoji-picker-element@1/index.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage-compat.js'
];

// Install service worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Fetch assets from cache or network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if available
                if (response) {
                    return response;
                }
                
                // Otherwise, fetch from network and cache
                return fetch(event.request)
                    .then((response) => {
                        // Clone the response (streams can only be read once)
                        const responseClone = response.clone();
                        
                        // Cache the response
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        
                        return response;
                    });
            })
    );
});

// Activate service worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // Delete old caches
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    );
});

// Listen for push notifications (requires Firebase Cloud Messaging)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body || 'Yeni mesaj var!',
            icon: data.icon || '/icons/icon-192x192.png',
            badge: data.badge || '/icons/badge-72x72.png',
            data: data.data || { url: '/' }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'MessGes', options)
        );
    }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.notification.data && event.notification.data.url) {
        clients.openWindow(event.notification.data.url);
    } else {
        clients.openWindow('/');
    }
});

// Background sync for failed requests (when back online)
self.addEventListener('sync', (event) => {
    if (event.tag === 'send-message') {
        event.waitUntil(sendQueuedMessages());
    }
});

// Send queued messages when back online
async function sendQueuedMessages() {
    const queue = await caches.open('message-queue');
    const requests = await queue.keys();
    
    for (const request of requests) {
        const response = await queue.match(request);
        const message = await response.json();
        
        try {
            // Try to send the message
            // Note: This would need Firebase to be available in the service worker
            // For now, we'll just log it
            console.log('Sending queued message:', message);
            
            // Remove from queue
            await queue.delete(request);
        } catch (error) {
            console.error('Failed to send queued message:', error);
        }
    }
}
