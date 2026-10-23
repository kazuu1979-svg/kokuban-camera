// 黒板カメラ：電波が無くても開けるように、画面の部品をスマホに置いておく
const CACHE = 'kokuban-camera-25';
const SHELL = ['./', './index.html', './app.js?v=25', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 自分の画面：まずネット、だめなら置いておいた物
  if (url.origin === location.origin) {
    e.respondWith(fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'}).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match(req, {ignoreSearch: true})).then(r => r || caches.match('./index.html'))));
    return;
  }
  // 字の形（Google Fonts）：置いておいた物を先に使う
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
  }
});