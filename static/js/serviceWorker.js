const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const cacheName = 'appCache';
const filesToCache = [];
const updateChannel = new BroadcastChannel('pwaUpdateChannel');

/* eslint-disable */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(filesToCache);
    }),
  );
});

/* eslint-disable */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  if (event.notification.data?.link) {
    clients.openWindow(event.notification.data.link);
  }
});

self.addEventListener('push', (event) => {
  if (!self.Notification || self.Notification.permission !== 'granted') {
    return;
  }

  const notification = event.data?.json();

  if (!notification) {
    return;
  }

  self.registration.showNotification(notification.message, {
    data: notification,
    icon: notification.icon,
  });
});

const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    self.addEventListener('load', () => {
      const swUrl = `/serviceWorker.js`;
      registerValidSW(swUrl);
    });
  }
};

const registerValidSW = (swUrl) => {
  navigator.serviceWorker
    .register(swUrl, { scope: '/' })
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;

        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            updateChannel.postMessage(true);
          }
        };
      };

      self.addEventListener('noloco.push.registerSubscription', () =>
        registration.pushManager.getSubscription().then((subscription) => {
          if (typeof localStorage === 'undefined') {
            return;
          }
          if (subscription) {
            const localStorageSubscription = localStorage.getItem(
              'noloco.push.subscription',
            );

            if (!localStorageSubscription) {
              localStorage.setItem(
                'noloco.push.subscription',
                JSON.stringify(subscription),
              );
              self.dispatchEvent(
                new Event('noloco.push.registeredSubscription'),
              );
            }

            return;
          }

          const VAPID_PUBLIC_KEY = JSON.parse(
            localStorage.getItem('noloco.push.vapidPublicKey'),
          );

          return registration.pushManager
            .subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
            })
            .then((newSubscription) => {
              const serializedNewSubscription = JSON.stringify(newSubscription);

              localStorage.setItem(
                'noloco.push.subscription',
                serializedNewSubscription,
              );
              self.dispatchEvent(
                new Event('noloco.push.registeredSubscription'),
              );
            });
        }),
      );
    })
    .catch((error) => {
      console.error('[Error]', error);
    });
};

const unregisterServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => {
        console.error(error.message);
      });
  }
};

registerServiceWorker();
