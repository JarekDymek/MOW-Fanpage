const CACHE='mow-fanpage-v1';
const CORE=['/','/manifest.webmanifest','/icons/icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));});
self.addEventListener('push',e=>{let d={title:'MOW Fanpage',body:'Masz nową informację.',url:'/'};try{d={...d,...e.data.json()}}catch{};e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'/icons/icon.svg',badge:'/icons/icon.svg',data:{url:d.url}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(e.notification.data?.url||'/');return c.focus()}}return clients.openWindow(e.notification.data?.url||'/')}));});
