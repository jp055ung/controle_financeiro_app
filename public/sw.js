const CACHE = 'nacarteira-v4';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // ignora extensões do Chrome, outros esquemas, outros domínios e métodos != GET
  if (req.method !== 'GET' || !url.protocol.startsWith('http') || url.origin !== self.location.origin) return;
  // API: sempre rede, nunca cache
  if (url.pathname.startsWith('/api/')) return;
  // resto: rede primeiro, cache só como reserva offline
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)).catch(()=>{}); }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('/')))
  );
});
