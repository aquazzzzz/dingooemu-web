const VERSION = __VERSION__;
const ASSETS = __ASSETS__;
const ROOT = self.registration.scope;
const PREFIX = 'dingoo-hybrid:' + encodeURIComponent(ROOT) + ':';
const CACHE = PREFIX + VERSION;
const URLS = ASSETS.map(path => new URL(path, ROOT).href);
const KNOWN = new Set(URLS);
const INDEX = new URL('index.html', ROOT).href;
let offlineStatus = {phase:'idle', completed:0, total:URLS.length};

async function reportOfflineStatus() {
  // First installs also need to reach pages not yet controlled by this worker.
  try {
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of clients) if (client.url.startsWith(ROOT))
      client.postMessage({type:'offline-status', scope:ROOT, ...offlineStatus});
  } catch { /* Progress reporting must not prevent installation. */ }
}

async function prepareOfflineCache() {
  const controller = new AbortController();
  let failure, next = 0;
  offlineStatus = {phase:'downloading', completed:0, total:URLS.length};
  await reportOfflineStatus();
  try {
    const cache = await caches.open(CACHE);
    // Limit concurrent downloads and include response-body/cache writes in the
    // timeout. A fetch can receive headers promptly but stall in its body.
    async function download() {
      while (!failure && next < URLS.length) {
        const index = next++;
        let reason = 'download';
        let timer;
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error('Offline resource timeout');
            if (!failure) failure = {reason:'timeout', resource:ASSETS[index], error};
            controller.abort();reject(error);
          }, 90000);
        });
        try {
          await Promise.race([(async () => {
            const response = await fetch(new Request(URLS[index], {cache:'reload', signal:controller.signal}));
            if (!response.ok || response.status === 206) throw new Error('Incomplete offline response');
            reason = 'storage';
            await cache.put(URLS[index], response);
          })(), deadline]);
          offlineStatus.completed++;
          await reportOfflineStatus();
        } catch (error) {
          if (!failure) failure = {reason, resource:ASSETS[index], error};
          controller.abort();
        } finally {clearTimeout(timer);}
      }
    }
    await Promise.all(Array.from({length:Math.min(4, URLS.length)}, download));
    if (failure) throw failure.error;
    offlineStatus = {...offlineStatus, phase:'ready'};
    await reportOfflineStatus();
    if (!self.registration.active) await self.skipWaiting();
  } catch (error) {
    // Timed-out cache writes cannot resume the workflow or recreate a deleted
    // named cache. The active older release and game/save databases are untouched.
    await caches.delete(CACHE).catch(() => {});
    offlineStatus = {...offlineStatus, phase:'failed', reason:failure?.reason || 'storage', resource:failure?.resource || ''};
    await reportOfflineStatus();
    throw error;
  }
}

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
  if (event.data?.type === 'offline-status') event.ports[0]?.postMessage({type:'offline-status', scope:ROOT, ...offlineStatus});
});

self.addEventListener('install', event => {
  event.waitUntil(prepareOfflineCache());
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
