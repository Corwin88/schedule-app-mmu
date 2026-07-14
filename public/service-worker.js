const CACHE_NAME = 'schedule-cache-v2'; // увеличим версию кэша, чтобы старый сбросился

// Установка: кэшируем статику (можно оставить)
self.addEventListener('install', event => {
  // Ничего не кэшируем при установке, чтобы не застревать на старых версиях.
  // При желании можно закэшировать только критические ресурсы.
  self.skipWaiting();
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Перехват запросов: СНАЧАЛА СЕТЬ, если нет сети – кэш.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Если ответ успешный, клонируем и сохраняем в кэш
        if (response && response.status === 200 && response.type === 'basic') {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
        }
        return response;
      })
      .catch(() => {
        // Офлайн – пытаемся достать из кэша
        return caches.match(event.request);
      })
  );
});

// Обработчик push-уведомлений (оставь как было)
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Расписание';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: data.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});