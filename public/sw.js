/* Versioned offline cache, scoped to the current GitHub Pages repo.
 * On initial install, discover and cache this deployment's Vite-built CSS/JS
 * directly from index.html, so the game works offline after its first load. */
const CACHE='slotcars-v1.3';
const ROOT=self.registration.scope;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const indexResponse=await fetch(ROOT,{cache:'reload'});
    if(!indexResponse.ok)throw new Error('Cannot cache offline shell');
    const markup=await indexResponse.clone().text();
    const paths=new Set([ROOT,new URL('manifest.webmanifest',ROOT).href,new URL('icons/icon.svg',ROOT).href]);
    const refs=markup.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css|svg)(?:\?[^"']*)?)["']/g);
    for(const hit of refs)paths.add(new URL(hit[1],ROOT).href);
    await cache.put(ROOT,indexResponse);
    await Promise.all([...paths].filter(url=>url!==ROOT).map(async url=>{
      try{await cache.add(new Request(url,{cache:'reload'}));}catch(e){console.warn('Offline asset not cached',url,e);}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('slotcars-')&&k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const clone=response.clone();caches.open(CACHE).then(c=>c.put(request,clone));}
      return response;
    }).catch(()=>caches.match(request).then(res=>res||caches.match(ROOT))));
  }else{
    event.respondWith(caches.match(request).then(res=>res||fetch(request).then(response=>{
      if(response.ok){const clone=response.clone();caches.open(CACHE).then(c=>c.put(request,clone));}
      return response;
    })));
  }
});
