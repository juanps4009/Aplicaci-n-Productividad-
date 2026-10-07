# Notas para continuar el proyecto (para Claude, en la nube o en el computador del dueño)

Lee esto primero. Resume qué es el proyecto, cómo está armado, qué quedó hecho, qué falta y cómo probar.
Última puesta al día: **7 oct 2026**. Las versiones 0.13 → 0.18 se hicieron en el computador del dueño; la **0.19 (Ingresos)** se hizo en una sesión en la nube, en la rama `claude/revisar-notas-pu0422`. El §4 dice qué quedó hecho y probado, el §5 qué falta, y el §9 qué cosas existen **solo en su computador** y una sesión en la nube no tiene.

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
- **Ingresos** (0.19): dentro de la pestaña «Trabajo», un interruptor **Oportunidades · Ingresos** (`state.workView`). Cada trabajo pagado es un registro `m:<id>` (`kind:"inc"`, `date`, `client`, `amount` en pesos enteros, `type` = `claude` «Con Claude» o `onsite` «Presencial», `note`) en `work.js` (`cleanIncome`, `addIncome`, `updateIncome`, `removeIncome`, `incomes`, `monthTotals`, `money`, `incomeToMarkdown`). `Work.clean` reparte por prefijo (`o:` → oportunidad, `m:` → ingreso), así que viajan por **el mismo canal que la rutina y las oportunidades** (`state.work` guarda ambos; las funciones de oportunidades filtran por `kind`). Un `m:` sin fecha o monto válidos no se entiende: se conserva en `routineOther` sin tocarlo. La vista muestra el mes (‹ ›, sin pasar del actual), el **total del mes** con reparto por tipo y las tarjetas del mes; al guardar un ingreso de otro mes se pasa a ese mes. El monto acepta `85000`, `85.000` o `$ 1,250,000`. La herramienta `herramientas/rutina.mjs` añade `ingresos [--mes AAAA-MM] [--json]` e `ingreso agregar|editar|quitar`, y `hoy` incluye el total del mes. El servidor y el widget no cambiaron.
- **Trabajo / Oportunidades y «Tu semana»** (0.18): pestaña «Trabajo» con las ofertas que el dueño sigue (título, enlace, fecha de cierre, estado *por revisar · apliqué · me respondieron · descartada*, nota, origen); el estado se cambia con un toque y las descartadas se ocultan. Lógica en `work.js` (pura, probada con Node): registros `o:<id>`, **enlaces solo `http(s)`**, orden por cierre, `closeInfo`, `closingSoon`, `findByUrl` (no duplicar). Viajan por **el mismo canal que la rutina** (`setRoutine` reparte en `state.routine`, `state.work` y `state.routineOther`; `routineAll()` los junta; se guarda con `commitRoutine`). En Rutina → Hoy hay una tarjeta **«Tu semana»** (porcentaje + un punto por día, `weekStats().days`). La herramienta `herramientas/rutina.mjs` toma el código de **`PENDIENTES_CODIGO`** (variable de entorno) o del archivo local, y añade `hoy`, `tarea agregar`, `oportunidades` y `oportunidad agregar|estado|editar|quitar`. Pendiente del plan del dueño: **Ingresos** (dentro de Trabajo), **Lectura** (dentro de Resúmenes), el **radar** de empleos (búsqueda programada que agregue ofertas como «por revisar») y el comentario semanal programado.
- **Rutina** (0.17): pestaña con pendientes que se repiten **cada día, semana o mes**, marcados con un toque, y **resumen semanal** (cuadrícula lunes–domingo, %, racha) con un **comentario de Claude**. `routine.js` (lógica pura, probada con Node) guarda una lista de registros: ítems `i:<id>` (`text`, `freq`, `days`, `order`), periodos `p:<día|semana ISO|mes>` (`done: {ítem: hora}`) y comentarios `r:<semana>`. Vive en `state.routine` (`prod.routine`); lo que esta versión no entiende se conserva en `state.routineOther`. **Sincronización sin tocar el servidor:** la colección local `routine` viaja como `books` con id `rt:…` (`ROUTINE_PREFIX`, traducción en `syncNow`); el widget de Android ignora `books`. **Acceso de Claude:** `herramientas/rutina.mjs` (Node, sin dependencias) usa `sync.js` + `routine.js` contra `/space/sync`; lee el código de sincronización de `%USERPROFILE%\.pendientes\codigo.txt` (lo guarda el dueño; el programa nunca lo imprime) y ofrece `ver`, `agregar`, `editar`, `quitar`, `marcar`, `desmarcar`, `comentario`, `importar`, `exportar`, `revisar`. La guía para que un Proyecto de claude.ai arme la lista (`RUTINA-GUIA.md`) y el `rutina.json` del dueño están **fuera del repositorio**, en la carpeta `Claude-Proyecto-App`.
- **Guardado y sincronización automáticos** (0.15): los resúmenes en edición se guardan solos (`scheduleBookSave`/`saveBookDraft`, 0,5 s; botón «Listo» en vez de Guardar/Cancelar), igual que las notas; al ocultar o cerrar la app se vuelca todo (`flushEdits`). `sync.js` lleva la lista de **pendientes de subir** (`tracker.dirty`, guardada en `prod.sync`) en lugar de fiarse solo del reloj. Se sincroniza 0,8 s después de cada cambio, cada 20 s con la app visible y al volver el foco/la conexión; reintento con espera creciente. Lo que llega para algo abierto solo espera mientras se teclea (`TYPING_MS`), y luego se redibuja el editor (`refreshOpenEditors`). El icono de nube de la cabecera muestra el estado (`renderSyncIcon`). El servidor no cambió.
- **Formato al escribir y alineación** (0.16): la barra de formato sale siempre que el cursor está en un campo (encima del teclado o de la barra de navegación). Sin selección, un botón cambia **lo próximo que se escriba** (`RE.apply` → `setTypingStyle`): parte el texto en el cursor y deja un ancla invisible `​` con ese estilo donde el navegador sigue escribiendo; no se redibuja al teclear (compatible con teclados de celular). Las posiciones ignoran esas anclas (`RE.noZW`, `RE.place`, `caretOffset`) y se limpian al salir del campo. En las paletas el primer círculo quita ese color (deja de subrayar/resaltar). **Alineación** centro/derecha por párrafo (`block.align`, `data-align`), por línea en los cuadros (`<clave>Aligns`) y por campo (`task.align`, `titleAlign`, `authorAlign`); solo se aceptan `center`/`right` (`RT.cleanAlign`). El espacio inferior de las páginas es fijo para que los botones no se muevan al aparecer la barra.
- **Texto con formato** (0.14): negrita, color de letra, resaltado, subrayado de color y tamaño en **todo texto escrito** (título de tarea, notas, título/autor y cuadros de los resúmenes). `richtext.js` (lógica pura, probada con Node) guarda el formato como **tramos** `{s,e,b,c,h,u,z}` junto al texto plano: `task.marks`, `block.marks` en los bloques de `doc`, y `<campo>Marks` en los libros (`titleMarks`, `authorMarks`, `ideasMarks`…). Todo lo que llega se limpia (solo `#rrggbb` y tamaños -1/1/2), así que nunca entra HTML. `richedit.js` maneja la selección, los campos de una línea (`.rt-line`, contenteditable) y la barra de formato (`#format-bar`, solo sale con texto seleccionado). Los cuadros por bloques usan el editor de bloques en modo `plain` (una línea = un bloque; se guardan como texto con `\n`). El widget de Android ignora los tramos (muestra texto plano).
- **Android (`android/`)**: widget en Java sin dependencias. Lee `/space/sync`, descifra con `TaskCrypto`, lista pendientes ordenadas por fecha y prioridad; al tocar una tarea abre `<app>#task=ID` (la app lo entiende: `focusTask`). Pantalla de ajustes con dos tarjetas: «usar el servidor de la app» o «mi propio servidor» + pegar código. La app web lo conecta con un enlace `intent://link?code=…#Intent;scheme=pendientes;…;S.browser_fallback_url=<APK directo>;end`.
  Desde la 1.2 es **un solo widget adaptable** (mín. 2x2): `TaskWidgetProvider.update` lee el tamaño (`OPTION_APPWIDGET_MIN_WIDTH/HEIGHT`) y `TaskLogic.isCompact` elige entre `widget.xml` (grande) y `widget_compact.xml` (2x2, 4x2; cabecera «Pendientes · N»); la lista usa `widget_item` o `widget_item_compact` según extras del servicio. Se redibuja en `onAppWidgetOptionsChanged`.
- **Windows**: `escritorio/Crear-acceso-directo.cmd` (+ `.url`, `LEEME.txt`, `icons/icon.ico`).

## 4. Estado actual (versión `0.19.0-beta`, ver `APP_VERSION` en `app.js`)

Hecho y probado con pruebas automáticas (ver §6): tareas, notas, resúmenes (con guardado automático), recordatorios (local), tema, texto con formato y alineación, rutina diaria/semanal/mensual con resumen semanal, oportunidades e ingresos (pestaña Trabajo), sincronización cifrada entre dispositivos (con el código del Worker real corriendo sobre una base simulada), QR/enlace de vinculación, borrado de datos del servidor, límites, push cifrado (con el servidor simulado), enlace `#task=`, PWA offline, APK compilado en CI y la herramienta de escritorio `herramientas/rutina.mjs`.

**Confirmado en el mundo real con el dueño** (2–7 oct 2026):
- El Worker de Cloudflare responde y tiene las rutas de la versión actual (`/space/sync`, `/space/delete`, `PUT /sync`, `POST /unsync`). No hubo que volver a pegar nada: la rutina y las oportunidades viajan como `books`.
- El widget de Android funciona (1.1) y el adaptable (1.2) también: «ya funciona». Para actualizarlo se usa el botón «Descargar la versión nueva del widget» de Ajustes (el de «Conectar» no vuelve a descargar) y hay que quitar y volver a añadir el widget.
- La herramienta de escritorio contra su cuenta real, en los dos sentidos: lo que Claude añade (pendiente de rutina, oportunidad) aparece en su app, y lo que él marca o cambia en la app se lee desde la herramienta.
- Acceso directo «Pendientes» en su escritorio (abre la app en Brave en modo aplicación).

**Sin confirmar todavía por el dueño:**
- Notificaciones push reales en un celular.
- En su celular: el formato de texto sin seleccionar y la alineación con el teclado de Android (0.16), la pestaña Rutina (0.17) y la pestaña Trabajo y la tarjeta «Tu semana» (0.18), y la vista Ingresos (0.19). Se probaron en Brave a tamaño de celular, no en un teléfono.
- Que el guardado automático de resúmenes llegue de celular a computador en ~20 s en uso real (se probó con dos navegadores simulados).
- Una prueba de navegador es intermitente: `tests/push-client.js` falló una vez y pasó tres seguidas al repetirla (no se tocó esa parte).

## 5. Pendiente / ideas

**Lo que el dueño pidió y falta** (su lista de 7 puntos; hechos: rutina, «Tu semana», oportunidades, **ingresos**, sincronización sin tocar el servidor, herramienta):
- **Lectura** (dentro de Resúmenes): libro que está leyendo y capítulo en el que va, conectado con sus resúmenes.
- **Su lista real de rutina:** está vacía. Puede dictarla, añadirla en la app, o usar `RUTINA-GUIA.md` con su Proyecto de claude.ai y pedir «carga mi rutina» (`herramientas/rutina.mjs importar`).
- **Comentario semanal programado:** falta que diga día y hora. Requiere su computador encendido.
- **Radar de empleos:** quiere 3–6 ofertas nuevas al día, remoto, ~8 h semanales entre semana y fines de semana, tareas que Claude pueda hacer con su supervisión (redacción, traducción, transcripción, diseño, atención por chat, programación); sin pago mínimo por ahora; descarta ventas por comisión y pagar para empezar. Primera búsqueda (7 oct): los portales de empleo no sirven para ese perfil y no se añadió ninguna oferta (una de CazVid tenía señales de estafa). Lo que encaja son mercados de encargos por proyecto (**Workana**), pero sus páginas bloquean la lectura automática: hace falta que **él cree la cuenta** y deje la sesión abierta en Brave, o que pegue los encargos. Quedó pendiente que conteste su **nivel de inglés** y si tiene **muestras de trabajo**, y preparar el texto de su perfil. Claude no aplica ni envía mensajes en su nombre sin confirmación, y descarta encargos cuyo cliente prohíba IA.

**Otras ideas:**
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

«Hola, ya leí las notas del proyecto: la app va en la 0.19 con Rutina, Trabajo (oportunidades e ingresos) y la herramienta. Quedan Lectura, tu lista de rutina, el comentario semanal y el radar de empleos. ¿Con cuál seguimos?»

## 9. Lo que existe solo en el computador del dueño (una sesión en la nube NO lo tiene)

- **Su código de sincronización:** en `C:\Users\Personal\.pendientes\codigo.txt`. Nunca se lee, se imprime ni se sube. En la nube, `herramientas/rutina.mjs` solo funciona si él define la variable de entorno/secreto `PENDIENTES_CODIGO` en ese entorno; sin eso no se puede leer ni cambiar su rutina, tareas u oportunidades (sí se puede programar y probar con las pruebas, que usan un código inventado).
- **`RUTINA-GUIA.md`** (guía para su Proyecto de claude.ai, con las preguntas de rutina y de empleo) y su futuro `rutina.json`: en la carpeta `Claude-Proyecto-App`, fuera del repositorio a propósito.
- **El repositorio clonado:** `C:\Users\Personal\OneDrive\Claude-Proyecto-App\Nueva carpeta\app` (él lo movió ahí). Tiene Git, Node 24 y GitHub CLI con sesión de `juanps4009`; los commits van con su correo `noreply` de GitHub.
- **Su navegador Brave** (con la extensión de Claude): sirve para correr las pruebas de navegador sin descargar Chromium (`CHROMIUM_PATH` apuntando a `brave.exe`) y sería la vía para ver Workana con su sesión. En la nube las pruebas de navegador necesitan `npx playwright install chromium`, y `python -m http.server 8123` o cualquier servidor estático en la raíz.
- **Accesos directos e iconos** de su escritorio (`Pictures\IconosApps`) y las tareas programadas locales (aún no hay ninguna).
- En Windows, `npm run unit`/`npm run e2e` funcionan; si se usa PowerShell 5.1 y se escriben archivos con acentos desde scripts, guardar en UTF-8 sin BOM (hubo comentarios dañados en `styles.css` por eso).
