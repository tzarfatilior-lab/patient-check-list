// Patient Check List: lets the pages open without a connection.
// Pages and files come from the network first, so a new version arrives as soon as there is a connection;
// the saved copy is used only when the network is missing or too slow.
// Patients' data never passes through here: it stays in the browser's own storage.
var CACHE = 'pcl-v8';
var SHELL = [
  './',
  './index.html',
  './manager.html',
  './manifest.webmanifest',
  './manager.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(request) {
  return caches.match(request, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    if (request.mode === 'navigate') return caches.match('./index.html');
    return undefined;
  });
}

// Network first; after 4 seconds without an answer, fall back to the saved copy if there is one.
function networkFirst(request) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      fromCache(request).then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } });
    }, 4000);
    fetch(request).then(function (response) {
      clearTimeout(timer);
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      if (!settled) { settled = true; resolve(response); }
    }, function () {
      clearTimeout(timer);
      fromCache(request).then(function (hit) {
        if (settled) return;
        settled = true;
        if (hit) resolve(hit); else reject(new Error('offline'));
      });
    });
  });
}

// Fonts rarely change: use the saved copy, fetch once otherwise.
function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    return hit || fetch(request).then(function (response) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      return response;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(cacheFirst(request));
  }
});
