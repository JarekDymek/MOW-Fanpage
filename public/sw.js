// No private API responses or photos are cached. Preserve localStorage and IndexedDB.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(name=>/^mow-fanpage-v\d+$/.test(name)).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(event.request.mode!=='navigate')return;
  event.respondWith(fetch(event.request).catch(()=>new Response(
    '<!doctype html><html lang="pl"><meta charset="utf-8"><title>MOW Fanpage</title><h1>Brak połączenia</h1><p>Połącz się z internetem i odśwież stronę.</p>',
    {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}}
  )));
});
