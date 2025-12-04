// Service Worker untuk QuizApp
const CACHE_NAME = 'quizapp-v3.0';
const DYNAMIC_CACHE = 'quizapp-dynamic-v1';
const urlsToCache = [
  './',
  './index.html',
  './quiz.html',
  './result.html',
  './admin.html',
  './edit.html',
  './style.css',
  './app.js',
  './user.js',
  './edit.js',
  './admin-firebase.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js',
  'https://img.icons8.com/color/192/whatsapp.png'
];

// INSTALL EVENT - Cache semua assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Install completed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// ACTIVATE EVENT - Hapus cache lama
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Activate completed');
      return self.clients.claim();
    })
  );
});

// FETCH EVENT - Strategi cache: Cache First, Network Fallback
self.addEventListener('fetch', event => {
  // Abort jika bukan HTTP request
  if (!event.request.url.startsWith('http')) return;
  
  // Abort untuk Chrome extensions
  if (event.request.url.includes('chrome-extension')) return;
  
  // Khusus Firebase, gunakan Network First
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Untuk file HTML, gunakan Network First
  if (event.request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone response untuk cache
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('./index.html');
            });
        })
    );
    return;
  }
  
  // Untuk assets lainnya (CSS, JS, gambar), gunakan Cache First
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Update cache di background
          fetch(event.request)
            .then(response => {
              return caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(event.request, response));
            })
            .catch(() => {}); // Silent fail
          return cachedResponse;
        }
        
        // Jika tidak ada di cache, fetch dari network
        return fetch(event.request)
          .then(response => {
            // Jangan cache response yang tidak valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response untuk cache
            const responseToCache = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Fallback khusus untuk file tertentu
            if (event.request.url.includes('.css')) {
              return new Response(
                'body { background: #075E54; color: white; padding: 20px; font-family: sans-serif; }',
                { headers: { 'Content-Type': 'text/css' } }
              );
            }
            if (event.request.url.includes('.js')) {
              return new Response(
                'console.log("Offline mode");',
                { headers: { 'Content-Type': 'application/javascript' } }
              );
            }
          });
      })
  );
});

// PUSH NOTIFICATION EVENT
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'QuizApp: Ada quiz baru!',
    icon: 'https://img.icons8.com/color/96/000000/whatsapp.png',
    badge: 'https://img.icons8.com/color/96/000000/whatsapp.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'quiz-notification'
    },
    actions: [
      {
        action: 'open',
        title: 'Buka Quiz'
      },
      {
        action: 'close',
        title: 'Tutup'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('QuizApp', options)
  );
});

// NOTIFICATION CLICK EVENT
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/quiz.html')
    );
  } else {
    event.waitUntil(
      clients.matchAll({
        type: 'window'
      })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// SYNC EVENT (untuk background sync)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-quiz-results') {
    console.log('[Service Worker] Background sync for quiz results');
    event.waitUntil(syncQuizResults());
  }
});

async function syncQuizResults() {
  try {
    // Implementasi sync untuk hasil quiz
    console.log('[Service Worker] Syncing quiz results...');
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// PERIODIC SYNC (jika browser support)
if ('periodicSync' in self.registration) {
  try {
    await self.registration.periodicSync.register('update-content', {
      minInterval: 24 * 60 * 60 * 1000 // 1 hari
    });
  } catch (error) {
    console.log('[Service Worker] Periodic sync not supported');
  }
}
