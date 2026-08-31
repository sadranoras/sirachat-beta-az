const CACHE_NAME = 'sirachat-v18-share-dnd';
const SHARE_DB = 'sirachat-share-target';
const SHARE_STORE = 'shared-files';

function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) db.createObjectStore(SHARE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeSharedFiles(files) {
  const db = await openShareDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE, 'readwrite');
    const store = tx.objectStore(SHARE_STORE);
    files.forEach((file, i) => store.put({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      name: file.name || `shared-${i}`,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified || Date.now(),
      blob: file
    }));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all(
      ['/', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
       '/mediapipe/selfie_segmentation.js', '/mediapipe/selfie_segmentation.binarypb',
       '/mediapipe/selfie_segmentation.tflite', '/mediapipe/selfie_segmentation_landscape.tflite',
       '/mediapipe/selfie_segmentation_solution_simd_wasm_bin.js', '/mediapipe/selfie_segmentation_solution_simd_wasm_bin.wasm',
       '/mediapipe/selfie_segmentation_solution_wasm_bin.js', '/mediapipe/selfie_segmentation_solution_wasm_bin.wasm'].map((p) =>
        caches.open(CACHE_NAME).then((cache) => fetch(p).then((res) => { if (res.ok) return cache.put(p, res); }).catch(() => {}))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/') {
    const isShare = url.searchParams.has('share-target') || url.searchParams.has('share_target');
    if (isShare) {
      event.respondWith((async () => {
        try {
          const form = await event.request.formData();
          const files = [];
          for (const value of form.getAll('files')) if (value instanceof File && value.size > 0) files.push(value);
          // Some browsers send the share-target file field under a slightly
          // different name; collect every File entry as a safe fallback.
          if (!files.length) for (const [, value] of form.entries()) if (value instanceof File && value.size > 0) files.push(value);
          if (files.length) await storeSharedFiles(files);
        } catch (e) { console.error('Share target handling failed', e); }
        return Response.redirect(new URL('/?shared=1', self.location.origin), 303);
      })());
      return;
    }
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(res => { const copy=res.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request,copy)); return res; }).catch(()=>caches.match(event.request).then(r=>r||caches.match('index.html'))));
    return;
  }
  event.respondWith(fetch(event.request).then(res => { if(res.ok){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy));} return res; }).catch(()=>caches.match(event.request)));
});

self.addEventListener('push', (event) => {
  let data = { title:'سیرا چت', body:'پیام جدید', chat_id:'', icon:'/icon-192.png', badge:'/icon-192.png' };
  try { if(event.data) data={...data,...event.data.json()}; } catch(e) { if(event.data) data.body=event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:data.icon,badge:data.badge,data:{chat_id:data.chat_id},vibrate:[200,100,200],tag:data.chat_id||'sirachat',renotify:true}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId=event.notification.data?.chat_id;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(c=>c.url.includes(self.location.origin));
    if(existing){existing.postMessage({type:'open-chat',chat_id:chatId});return existing.focus();}
    return self.clients.openWindow(chatId?`/?chat=${chatId}`:'/');
  }));
});
