# Notas para continuar el proyecto (para Claude en el computador del dueño)

Lee esto primero. Resume qué es el proyecto, cómo está armado, qué quedó hecho, qué falta y cómo probar.
Las conversaciones anteriores se hicieron con Claude en la nube; **esta es la primera vez que hay acceso al computador del dueño**.

## 1. Qué es y qué quiere el dueño

**Pendientes y Resúmenes**: app web instalable (PWA) en español, minimalista y pensada primero para celular, con:
- **Pendientes**: tareas con prioridad (punto o borde), fecha límite, agrupación por fecha o prioridad, filtro, notas por tarea con editor libre (comando `/` para título, subtítulo, lista, cita), y **recordatorios** por tarea.
- **Resúmenes de libros**: lista compacta (título y autor pequeño) → al entrar, página completa. Plantilla «Por bloques» (4 cuadros) o «Libre» (editor con `/`, con puntos de navegación a la derecha, uno por título).
- Tema claro/oscuro con un interruptor, sincronización entre celular y computador, widget de Android.

Preferencias del dueño (respétalas): todo **gratis**; interfaz **simple y limpia**; que **una persona normal** use sincronización y widget con **un botón**, sin crear servidores; textos en **español**; quiere probar rápido y dar retroalimentación constante. No quiere que se le pida hacer pasos técnicos largos.

## 2. Dónde vive todo

| Cosa | Dónde |
|---|---|
| Código | Repositorio GitHub `juanps4009/Aplicaci-n-Productividad-`, rama de trabajo **`claude/hopeful-brahmagupta-m6bura`** (no hay pull request ni rama principal con contenido) |
| App publicada | GitHub Pages, sirve directamente esa rama: `https://juanps4009.github.io/Aplicaci-n-Productividad-/` (se actualiza 1-2 min tras cada push) |
| Servidor | Cloudflare Worker + D1 del dueño: `https://avisos-productividad.juanrincon-oy.workers.dev` (código en `worker/index.js`; el dueño lo pega en el panel de Cloudflare) |
| APK del widget | Lo compila GitHub Actions (`.github/workflows/android-widget.yml`) y lo publica en la Release `widget-latest`, archivo `pendientes-widget.apk` |
| Copia de pruebas | Artefacto de claude.ai `https://claude.ai/artifact/C1QR1KRPKQW9xQ1R7n4LxW` (generada con `python3 scripts/build-beta.py` → `dist/beta.html`, ignorada por git; en el artefacto no hay service worker ni push) |

**Configuración de un solo lugar:** `config.js` (`server`, `widgetDownload`, `widgetScheme`, `widgetPackage`). El APK lee `server` de ese archivo al compilar.

## 3. Arquitectura (resumen)

- **Sin dependencias ni build** salvo `scripts/build-beta.py`. Archivos clásicos cargados por `index.html` en este orden: `vendor/qrcode.js` (MIT), `config.js`, `reminders.js`, `sync.js`, `app.js`. `styles.css` usa variables CSS (claro/oscuro).
- **Datos**: `localStorage` (`prod.tasks`, `prod.books`, `prod.settings`, `prod.sync`, `prod.tomb`, `prod.remstate`…). Migraciones de formatos antiguos al arrancar en `app.js` (`migrateTask`, `migrateBook`, `migrateStorage`, `loadList` descarta datos dañados). **Ojo**: un error en este arranque deja la app muerta; hay pruebas de migración.
- **`reminders.js`** (puro): `occurrences`, `nextFires`, `dueFires`, `describe`. Tipos: una vez, antes del vencimiento, diario, semanal, cada X horas. El estado «ya sonó» es **local por dispositivo** (`state.remState`); los «posponer» llevan `onlyDevice`.
- **`sync.js`** (puro): códigos de 20 caracteres Crockford, `spaceId` = SHA-256 del código, sellos `updatedAt` automáticos (`stampChanges`), borrados como tombstones, fusión «gana el cambio más reciente por registro» (`mergeIncoming`), y **cifrado de extremo a extremo** AES-256-GCM con clave HKDF del código (formato `e1:` + base64url(iv+cifrado), AAD `id|col`).
- **`worker/index.js`**: `GET /` (texto «…funcionando ✓»), `GET /vapid`, `PUT /sync` y `POST /unsync` (avisos push, cifrados con una clave por dispositivo guardada en IndexedDB para que `sw.js` los descifre), `POST /space/sync` (sincronización, devuelve cambios con `seq`), `POST /space/delete`. Cron cada minuto envía los push (Web Push RFC 8291 + VAPID, claves generadas solas en D1). Límites por IP/código/tamaño. Los datos sincronizados llegan **cifrados**: el servidor no puede leerlos.
- **`sw.js`**: caché «red primero» (sube `CACHE` si cambia la lista de archivos), `importScripts("sync.js")`, manejo de `push` y `notificationclick`.
- **Trabajo / Oportunidades y «Tu semana»** (0.18): pestaña «Trabajo» con las ofertas que el dueño sigue (título, enlace, fecha de cierre, estado *por revisar · apliqué · me respondieron · descartada*, nota, origen); el estado se cambia con un toque y las descartadas se ocultan. Lógica en `work.js` (pura, probada con Node): registros `o:<id>`, **enlaces solo `http(s)`**, orden por cierre, `closeInfo`, `closingSoon`, `findByUrl` (no duplicar). Viajan por **el mismo canal que la rutina** (`setRoutine` reparte en `state.routine`, `state.work` y `state.routineOther`; `routineAll()` los junta; se guarda con `commitRoutine`). En Rutina → Hoy hay una tarjeta **«Tu semana»** (porcentaje + un punto por día, `weekStats().days`). La herramienta `herramientas/rutina.mjs` toma el código de **`PENDIENTES_CODIGO`** (variable de entorno) o del archivo local, y añade `hoy`, `tarea agregar`, `oportunidades` y `oportunidad agregar|estado|editar|quitar`. Pendiente del plan del dueño: **Ingresos** (dentro de Trabajo), **Lectura** (dentro de Resúmenes), el **radar** de empleos (búsqueda programada que agregue ofertas como «por revisar») y el comentario semanal programado.
- **Rutina** (0.17): pestaña con pendientes que se repiten **cada día, semana o mes**, marcados con un toque, y **resumen semanal** (cuadrícula lunes–domingo, %, racha) con un **comentario de Claude**. `routine.js` (lógica pura, probada con Node) guarda una lista de registros: ítems `i:<id>` (`text`, `freq`, `days`, `order`), periodos `p:<día|semana ISO|mes>` (`done: {ítem: hora}`) y comentarios `r:<semana>`. Vive en `state.routine` (`prod.routine`); lo que esta versión no entiende se conserva en `state.routineOther`. **Sincronización sin tocar el servidor:** la colección local `routine` viaja como `books` con id `rt:…` (`ROUTINE_PREFIX`, traducción en `syncNow`); el widget de Android ignora `books`. **Acceso de Claude:** `herramientas/rutina.mjs` (Node, sin dependencias) usa `sync.js` + `routine.js` contra `/space/sync`; lee el código de sincronización de `%USERPROFILE%\.pendientes\codigo.txt` (lo guarda el dueño; el programa nunca lo imprime) y ofrece `ver`, `agregar`, `editar`, `quitar`, `marcar`, `desmarcar`, `comentario`, `importar`, `exportar`, `revisar`. La guía para que un Proyecto de claude.ai arme la lista (`RUTINA-GUIA.md`) y el `rutina.json` del dueño están **fuera del repositorio**, en la carpeta `Claude-Proyecto-App`.
- **Guardado y sincronización automáticos** (0.15): los resúmenes en edición se guardan solos (`scheduleBookSave`/`saveBookDraft`, 0,5 s; botón «Listo» en vez de Guardar/Cancelar), igual que las notas; al ocultar o cerrar la app se vuelca todo (`flushEdits`). `sync.js` lleva la lista de **pendientes de subir** (`tracker.dirty`, guardada en `prod.sync`) en lugar de fiarse solo del reloj. Se sincroniza 0,8 s después de cada cambio, cada 20 s con la app visible y al volver el foco/la conexión; reintento con espera creciente. Lo que llega para algo abierto solo espera mientras se teclea (`TYPING_MS`), y luego se redibuja el editor (`refreshOpenEditors`). El icono de nube de la cabecera muestra el estado (`renderSyncIcon`). El servidor no cambió.
- **Formato al escribir y alineación** (0.16): la barra de formato sale siempre que el cursor está en un campo (encima del teclado o de la barra de navegación). Sin selección, un botón cambia **lo próximo que se escriba** (`RE.apply` → `setTypingStyle`): parte el texto en el cursor y deja un ancla invisible `​` con ese estilo donde el navegador sigue escribiendo; no se redibuja al teclear (compatible con teclados de celular). Las posiciones ignoran esas anclas (`RE.noZW`, `RE.place`, `caretOffset`) y se limpian al salir del campo. En las paletas el primer círculo quita ese color (deja de subrayar/resaltar). **Alineación** centro/derecha por párrafo (`block.align`, `data-align`), por línea en los cuadros (`<clave>Aligns`) y por campo (`task.align`, `titleAlign`, `authorAlign`); solo se aceptan `center`/`right` (`RT.cleanAlign`). El espacio inferior de las páginas es fijo para que los botones no se muevan al aparecer la barra.
- **Texto con formato** (0.14): negrita, color de letra, resaltado, subrayado de color y tamaño en **todo texto escrito** (título de tarea, notas, título/autor y cuadros de los resúmenes). `richtext.js` (lógica pura, probada con Node) guarda el formato como **tramos** `{s,e,b,c,h,u,z}` junto al texto plano: `task.marks`, `block.marks` en los bloques de `doc`, y `<campo>Marks` en los libros (`titleMarks`, `authorMarks`, `ideasMarks`…). Todo lo que llega se limpia (solo `#rrggbb` y tamaños -1/1/2), así que nunca entra HTML. `richedit.js` maneja la selección, los campos de una línea (`.rt-line`, contenteditable) y la barra de formato (`#format-bar`, solo sale con texto seleccionado). Los cuadros por bloques usan el editor de bloques en modo `plain` (una línea = un bloque; se guardan como texto con `\n`). El widget de Android ignora los tramos (muestra texto plano).
- **Android (`android/`)**: widget en Java sin dependencias. Lee `/space/sync`, descifra con `TaskCrypto`, lista pendientes ordenadas por fecha y prioridad; al tocar una tarea abre `<app>#task=ID` (la app lo entiende: `focusTask`). Pantalla de ajustes con dos tarjetas: «usar el servidor de la app» o «mi propio servidor» + pegar código. La app web lo conecta con un enlace `intent://link?code=…#Intent;scheme=pendientes;…;S.browser_fallback_url=<APK directo>;end`.
  Desde la 1.2 es **un solo widget adaptable** (mín. 2x2): `TaskWidgetProvider.update` lee el tamaño (`OPTION_APPWIDGET_MIN_WIDTH/HEIGHT`) y `TaskLogic.isCompact` elige entre `widget.xml` (grande) y `widget_compact.xml` (2x2, 4x2; cabecera «Pendientes · N»); la lista usa `widget_item` o `widget_item_compact` según extras del servicio. Se redibuja en `onAppWidgetOptionsChanged`.
- **Windows**: `escritorio/Crear-acceso-directo.cmd` (+ `.url`, `LEEME.txt`, `icons/icon.ico`).

## 4. Estado actual (versión `0.18.0-beta`, ver `APP_VERSION` en `app.js`)

Hecho y probado con pruebas automáticas (ver §6): tareas, notas, resúmenes, recordatorios (local), tema, sincronización cifrada entre dispositivos (con el código del Worker real corriendo sobre una base simulada), QR/enlace de vinculación, borrado de datos del servidor, límites, push cifrado (con el servidor simulado), enlace `#task=`, PWA offline, APK compilado en CI.

**Nunca se probó en el mundo real** (el entorno en la nube no podía): 
- El Worker desplegado en Cloudflare con tráfico real (el dueño dice que lo creó; **no está confirmado que pegara la última versión de `worker/index.js`** — pídele que abra la dirección y compruebe, y que vuelva a pegar el archivo si hace falta).
- Notificaciones push reales en un celular.
- El widget en un Android real. El último error reportado (Android 14: «error al añadir el widget») se atribuyó a un `PendingIntent` mutable implícito y se corrigió con `OpenTaskActivity`; **el dueño confirmó que el widget (1.1) funciona** (2 oct 2026). La 1.2 (tamaños adaptables) hay que confirmarla en el celular: que se estire/achique bien entre 2x2, 4x2 y grande.
- Que «Conectar el widget» (enlace `intent://`) descargue el APK y luego conecte con un toque.
- Que `Crear-acceso-directo.cmd` funcione en su Windows (no se pudo ejecutar).

## 5. Pendiente / ideas

- Confirmar con el dueño lo de arriba y corregir lo que falle.
- Pedido original aún sin hacer: acceso directo/atajos y, a futuro, publicar en Play Store (cuesta 25 USD una vez; el dueño prefiere gratis por ahora). Opción: empaquetar la PWA con Bubblewrap/PWABuilder.
- Mejoras posibles: acciones de «posponer» dentro de la notificación push (hoy se pospone desde el recuadro de la app), copia de seguridad exportar/importar, versión de escritorio con diseño más ancho (hoy el contenido está centrado a 640 px), más comandos del editor (casillas, separador), subtítulos como puntos en el carril del resumen.
- Seguridad/privacidad: cualquiera con el código ve los datos; si se pierde el código no hay recuperación. `privacidad.html` lo explica. No hay cuentas.
- Si el servicio crece: vigilar el plan gratuito de Cloudflare (peticiones diarias, D1).

## 6. Cómo probar

Hay una carpeta `tests/` con **pruebas automáticas** (ver `tests/README.md`): `npm run unit` (lógica y servidor, sin navegador) y `npm run e2e` (navegador, requiere `python -m http.server 8123` en la raíz). Node ≥ 22.13. Para la lógica del widget Java se usó `javac` contra `android-all` (no está en el repo); la compilación real la valida GitHub Actions.

Flujo de trabajo usado: cambiar → correr pruebas → `python3 scripts/build-beta.py` (si se quiere republicar la copia de pruebas) → commit y push a la rama → esperar el despliegue de Pages. **No abrir pull request ni tocar otras ramas sin que el dueño lo pida.**

## 7. Datos que NO debes pedir ni guardar

Códigos de sincronización de personas, contraseñas, tokens. La dirección del Worker es pública (está en `config.js`). La llave `android/debug.keystore` es de depuración y pública a propósito (solo permite actualizar el APK encima del anterior).

## 8. Primer mensaje sugerido para el dueño

«Hola, soy Claude en tu computador. Primero voy a comprobar tres cosas: (1) que tu servidor responde, (2) que el acceso directo del escritorio quedó bien, y (3) que el widget se instaló. ¿Quieres que empiece por el acceso directo?»
