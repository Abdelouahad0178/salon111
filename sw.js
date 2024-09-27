self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open('3d-scene-cache').then((cache) => {
        return cache.addAll([
          '/index.html',
          '/styles.css',
          '/script.js',
          '/images/MAISON CARRELAGE.jpg'
        ]);
      })
    );
  });
  
  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  });
  