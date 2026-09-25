const CACHE = 'camutanga-v41-recomeco-ui';
const SHELL = [
  './','./index.html','./jogo.html.html','./background.css','./background.js',
  './fonts/gamefont.css','./icon/icon.png','./manifest.webmanifest',
  './js/main.js','./js/plugins.js',
  './js/plugins/CamutangaLife.js','./js/plugins/CamutangaHero.js',
  './js/plugins/CamutangaPolish.js','./js/plugins/CamutangaWorld.js',
  './js/plugins/CamutangaDevMenu.js','./js/plugins/CamutangaUI26.js',
  './js/plugins/CamutangaMotion26.js','./js/plugins/CamutangaV3.js',
  './js/plugins/CamutangaFreeRoam.js','./js/plugins/CamutangaCidadeViva.js','./js/plugins/CamutangaSocial35.js','./js/plugins/CamutangaRelaunch40.js','./js/plugins/CamutangaUX41.js'
];

async function clearOldCaches(){
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => /^camutanga/i.test(k) && k !== CACHE).map(k => caches.delete(k)));
}

self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE);
    // Um arquivo ausente nao impede o Service Worker inteiro de instalar.
    await Promise.all(SHELL.map(async url => {
      try {
        const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=41', {cache:'no-store'});
        if (r && r.ok) await cache.put(url, r.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    await clearOldCaches();
    await self.clients.claim();
    // Quando uma versao nova ativa, recarrega paginas abertas uma unica vez.
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    for (const client of clients) {
      try { await client.navigate(client.url); } catch (_) {}
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CAMUTANGA_CLEAR_CACHE') {
    event.waitUntil((async()=>{
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => /^camutanga/i.test(k)).map(k => caches.delete(k)));
    })());
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  const path = url.pathname.toLowerCase();
  const isCode = event.request.mode === 'navigate' || /\.(?:html?|js|json|css|webmanifest)$/.test(path) || path.endsWith('/sw.js');

  if (isCode) {
    // CODIGO: rede primeiro. Evita que versoes antigas fiquem presas no navegador.
    event.respondWith((async()=>{
      try {
        const fresh = await fetch(event.request, {cache:'no-store'});
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(event.request, {ignoreSearch:true})) || Response.error();
      }
    })());
    return;
  }

  // IMAGENS/AUDIO: cache primeiro para manter o jogo rapido e funcionar offline.
  event.respondWith((async()=>{
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone()).catch(()=>{});
      }
      return response;
    } catch (_) {
      return Response.error();
    }
  })());
});
