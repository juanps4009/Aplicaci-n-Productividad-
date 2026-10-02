# Pruebas

Necesitas Node 22.13 o más reciente (usa `node:sqlite` para simular la base D1 del servidor).

```
cd tests
npm install                       # instala Playwright
npx playwright install chromium   # el navegador de pruebas (solo la primera vez)
npm run unit                      # lógica pura y servidor: sin navegador, tarda segundos
```

Las pruebas de navegador (`npm run e2e`) necesitan la app servida en `http://localhost:8123`:

```
# en otra terminal, desde la carpeta raíz del repositorio:
python -m http.server 8123
# y aquí:
npm run e2e
```

(Si usas otro Chromium: `CHROMIUM_PATH=/ruta/al/chrome`.)

| Archivo | Qué prueba |
|---|---|
| `rem-test.js` | `reminders.js`: cálculo de avisos (una vez, antes del vencimiento, diario, semanal, cada X h), por dispositivo |
| `sync-test.js` | `sync.js`: códigos, sellos de cambio, borrados, fusión «gana lo más reciente» |
| `sync-crypto-test.js` | Cifrado de extremo a extremo (AES-GCM + HKDF); imprime un vector que usa la prueba Java del widget |
| `sw-test.js` | `sw.js`: descifrado de avisos push con la clave del dispositivo |
| `worker-test.mjs` | `worker/index.js`: API, cifrado Web Push, firma VAPID, sincronización, límites (con D1 simulada) |
| `sync-e2e.mjs` | Dos dispositivos + un Android simulado contra el código real del servidor |
| `full4.js`, `full5.js` | Tareas, notas, resúmenes, recordatorios, tema |
| `push-client.js`, `deeplink.js`, `legacy.js`, `mig.js`, `cfg.js` | Avisos push, enlace `#task=`, datos de versiones antiguas, migraciones, `config.js` |

La lógica del widget de Android (`android/…/TaskLogic.java`, `TaskCrypto.java`, `ServerChoice.java`) se probó aparte con Java
normal y las clases reales de Android 14 (`android-all` de Robolectric); esas pruebas no están en el repositorio: la compilación
completa la hace GitHub Actions (`.github/workflows/android-widget.yml`).
