/* Service worker: funciona sin conexión.
   Estrategia "red primero": si hay internet siempre carga la versión más nueva y la guarda;
   si no hay, usa la copia guardada. Sube CACHE si cambias la lista de archivos. */
const CACHE = "productividad-v9";
importScripts("sync.js"); // trae Sync (descifrado de los avisos)
const FILES = ["./", "index.html", "styles.css", "app.js", "config.js", "reminders.js", "sync.js", "routine.js", "richtext.js", "richedit.js", "vendor/qrcode.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))));
});

/* Al tocar una notificación: abrir (o enfocar) la app */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => "focus" in c);
    return open ? open.focus() : self.clients.openWindow("./");
  }));
});

/* Clave de avisos de este dispositivo (la guarda la app en IndexedDB) */
function readPushKey() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("prod-keys", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const get = req.result.transaction("kv").objectStore("kv").get("pushKey");
      get.onsuccess = () => { req.result.close(); resolve(get.result); };
      get.onerror = () => reject(get.error);
    };
  });
}

/* El servidor entrega el texto cifrado; aquí se descifra con la clave del dispositivo */
async function openPayload(data) {
  if (!data.title || !data.title.startsWith("e1:")) return { title: data.title, body: data.body }; // formato antiguo
  try {
    const key = await Sync.importRawKey(await readPushKey());
    const o = JSON.parse(await Sync.decryptText(key, data.title, data.tag || ""));
    return { title: o.t, body: o.b };
  } catch {
    return { title: "Tienes un recordatorio", body: "Abre la app para verlo." };
  }
}

/* Notificación push enviada por el servidor de avisos.
   Si la app está a la vista, ella misma avisa (evita duplicados). */
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { /* mensaje sin formato */ }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((c) => c.visibilityState === "visible")) return;
    const { title, body } = await openPayload(data);
    await self.registration.showNotification(title || "Recordatorio", {
      body: body || "", tag: data.tag || undefined,
      icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    });
  })());
});
