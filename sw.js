const CACHE='camutanga-v3-1-mundo-livre';
const SHELL=['./','./index.html','./background.css','./background.js','./fonts/gamefont.css','./icon/icon.png','./js/main.js','./js/plugins.js','./js/plugins/CamutangaLife.js','./js/plugins/CamutangaHero.js','./js/plugins/CamutangaPolish.js','./js/plugins/CamutangaWorld.js','./js/plugins/CamutangaDevMenu.js','./js/plugins/CamutangaUI26.js','./js/plugins/CamutangaMotion26.js','./js/plugins/CamutangaV3.js','./js/plugins/CamutangaFreeRoam.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  const fresh=/\.(js|json)$/i.test(u.pathname)||u.pathname.endsWith('/sw.js');
  if(fresh){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));return;}
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r;})));
});
