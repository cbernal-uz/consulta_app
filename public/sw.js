// Service worker de la versión web de Consulta.
// 1. Guarda la app para que abra aunque no haya conexión (los datos ya están en el dispositivo).
// 2. Añade las cabeceras COOP y COEP si el servidor no las manda: sin ellas no hay SharedArrayBuffer
//    y la base de datos (SQLite en WebAssembly) no arranca.

const CACHE = 'consulta-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function conCabeceras(r) {
  if (!r || r.status === 0 || r.type === 'opaque' || r.type === 'opaqueredirect') return r;
  const h = new Headers(r.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

async function deRed(req, clave) {
  const r = await fetch(req);
  if (r.ok) (await caches.open(CACHE)).put(clave ?? req, r.clone());
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Supabase y cualquier otro servidor: sin tocar.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Primero la red, para recibir la última versión; sin conexión, la copia guardada.
    e.respondWith(deRed(req, '/').catch(async () => (await caches.match('/')) ?? Response.error()).then(conCabeceras));
    return;
  }
  // Los archivos de /_expo y /assets llevan un hash en el nombre: si están guardados no cambian.
  const fijo = url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/');
  e.respondWith((async () => {
    const guardada = await caches.match(req);
    if (guardada && fijo) return conCabeceras(guardada);
    try {
      return conCabeceras(await deRed(req));
    } catch (err) {
      if (guardada) return conCabeceras(guardada);
      throw err;
    }
  })());
});
