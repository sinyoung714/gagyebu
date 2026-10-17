var EXEC = 'https://script.google.com/macros/s/AKfycbyPhpnWs8d-LNE9jnz0Blt4ix669Mw1oi7TL08KraFUqw7z5HZqeca5eeXL_Q8ngiU2lA/exec';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
e.waitUntil(caches.open('hb').then(function (c) { return c.match('hb-auth'); }).then(function (r) { return r ? r.json() : null; }).then(function (a) {
if (!a) return null;
return fetch(EXEC, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'peek', key: a.key }) }).then(function (r) { return r.json(); });
}).catch(function () { return null; }).then(function (m) {
m = m || {};
return self.registration.showNotification(m.title || '융림이네 가계부', { body: m.body || '새 알림이 있어요.', icon: 'apple-touch-icon.png', badge: 'apple-touch-icon.png', tag: 'gagyebu', renotify: true });
}));
});
self.addEventListener('notificationclick', function (e) {
e.notification.close();
e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) { for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) return cs[i].focus(); } return self.clients.openWindow('./'); }));
});
