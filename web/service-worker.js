const VERSION = __VERSION__;
const ASSETS = __ASSETS__;
const ROOT = self.registration.scope;
const PREFIX = 'dingoo-hybrid:' + encodeURIComponent(ROOT) + ':';
const CACHE = PREFIX + VERSION;
const URLS = ASSETS.map(path => new URL(path, ROOT).href);
const KNOWN = new Set(URLS);
const INDEX = new URL('index.html', ROOT).href;

// Pages cannot configure HTTP headers. Apply the same policy to network and
// cached documents, worker scripts and Wasm, inside this application's scope.
function isolatedResponse(response) {
  if (response.status === 0 || (response.url && new URL(response.url).origin !== self.location.origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  // Fetch has already decoded the body; these describe the network encoding.
  headers.delete('Content-Encoding');
  headers.delete('Content-Length');
  return new Response(response.body, {status:response.status, statusText:response.statusText, headers});
}

self.addEventListener('message', event => {
  if (event.data?.type === 'isolation-status') event.ports[0]?.postMessage({version:VERSION, isolation:true});
});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // Every cached response receives the policy when served, including offline.
      await cache.addAll(URLS.map(url => new Request(url, {cache:'reload'})));
      if (!self.registration.active) await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Updates wait until the previous application's windows have all closed.
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  // Cache clearing unregisters us, but this document remains controlled until
  // navigation. Fetch the next document afresh without reopening the old cache.
  if (event.request.mode === 'navigate' && url.searchParams.has('__dingoo_cache_reset')) {
    event.respondWith(fetch(new Request(event.request, {cache:'reload'})).then(isolatedResponse));
    return;
  }
  url.search = '';
  url.hash = '';
  // Only the app root aliases index.html; this is not a catch-all SPA router. A root installation
  // must not replace another project's document under /<repo>/ with its index.
  const key = event.request.mode === 'navigate' && url.href === ROOT ? INDEX : url.href;
  event.respondWith((async () => {
    const cached = KNOWN.has(key) ? await (await caches.open(CACHE)).match(key) : undefined;
    return isolatedResponse(cached || await fetch(event.request));
  })());
});
