# Conclusiones de Diseño y Plan de Trabajo (`conclusiones-diseno.md`)

## Resumen

Este plan unifica la dirección de arte entre Claude y Gemini para que **la lista del día sea la protagonista** en celular (`390×844`) y computador (`1440×900`), eliminando tarjetas duplicadas, cajas innecesarias y botones repetidos que empujan tus tareas hacia abajo. Toda la interfaz usará un único color de acento (**azul cobalto** `#0b5cab` en claro y `#6eb5ff` en oscuro, incluido el nuevo icono de la app), reservando el rojo (`--high`) solo para lo urgente o vencido, y dejando un espacio libre al final de cada pantalla para que el botón flotante **«+ Anotar»** nunca tape el último elemento. Los estados vacíos serán tranquilos (una sola línea con un atajo directo, sin «0 %» ni «$ 0» gigantes), las listas pasarán a ser filas limpias separadas por una línea fina de `1px`, y las animaciones serán rápidas y fluidas (`transform` y `opacity`). Resolvimos todas las diferencias técnicas entre ambos agentes con pruebas en el código y separamos **2 decisiones de gusto personal** para que tú elijas antes de tocar esas partes, organizando los cambios en **4 bloques pequeños y seguros**.

---

## Cambios por pantalla (01–10 + estados vacíos)

### 01. Inicio (sobre todo la tarjeta «Tu día»)

**Qué se cambia:**
- En «Lo importante hoy», las tareas pasan arriba para verse completas apenas abres la app en el celular, sin hacer scroll.
- Cuando no hay nada para hoy (estado vacío), se oculta el bloque superior del anillo («0 %» y «Tareas 0/0 · Hábitos 0/0») y queda una sola línea tranquila con un botón para anotar.
- Las tareas vencidas se marcan en rojo de urgencia (`--high`) con la palabra «Vencida», en vez del naranja de racha (`--fire`), y las casillas pasan a un tamaño limpio de `22px` con un punto de color de `8px` para la prioridad.
- En la lista de las 4 áreas («Pendientes», «Rutina», «Ingresos/Trabajo», «Resúmenes»), se acortan los textos secundarios para que nunca se corten a mitad de palabra (como hoy pasa con `1 of...` o `Aún no hay resúmen...`).
- En celular se quita la tarjeta inferior «Tu semana» (porque repite lo que ya dice la fila «Rutina» y la pestaña Rutina), y se elimina del código el botón flotante viejo (`#home-add`) que estaba oculto.

**Por qué:**
- Idea rectora y §0.3 / §1 / §2 de `art-direction` (+ `impeccable` modo *Operate* y `apple-design` *Simplicity*): las tareas del día deben verse en el primer pantallazo, los estados vacíos nunca gritan «0 %» en tamaño titular, y el color de urgencia es `--high`, no el de racha.

**Detalle técnico:**
- **Archivos y selectores:**
  - `home.js`: `renderHome()` (`home.js:66-154`), `homeTaskHTML()` (`home.js:56-64`). Acortar textos en `tiles` (`home.js:99-111`): en Ingresos mostrar `$ 430.000 este mes` o `1 por cerrar` sin concatenar textos largos que trunquen en `390px`; en Resúmenes vacío usar `Sin resúmenes`.
  - `index.html`: quitar `#home-add` (`index.html:119-124`) y `.home-fab` (`home.js:153`, `tablero.css:294-303`, `capture.css:104`).
  - `tablero.css`: `.home-day` (`228`), `.home-task .chk` (`246-253` → `width: 22px; height: 22px; border: 2px solid var(--faint)`, quitar `transform: scale(1.06)` en reposo y usar `.dot` de `8px` con `background: var(--prio)`), `.home-task small` (`257-258` → `font-size: var(--text-sm); color: var(--muted)` y `.late { color: var(--high) }`), `.home-focus > .home-task + .home-task { border-top: 1px solid var(--border); border-radius: 0 }`.
  - Si `.home-week` se conserva en escritorio (`≥1024px`), cambiar `.week-bars i` (`home.js:119`, `tablero.css:288`) de `style="height:..."` a `height: 72px; transform-origin: bottom; transform: scaleY(var(--v, 0.08))` en `var(--surface-2)` y hoy en `var(--accent)` (`emil-design-eng`: animar solo `transform`).
- **Estado vacío (`total === 0 && focus.length === 0`):** no renderizar `.home-day-top` ni `.home-focus-head`; renderizar `<p class="home-empty">Nada pendiente para hoy. · <button type="button" class="link-accent" data-action="home-qc">Anotar algo</button></p>` en `--text-sm` `--muted` y acción en `--accent` (`font-weight: 600`).

---

### 02. Pendientes

**Qué se cambia:**
- Se elimina la duplicidad de dos botones azules primarios en la misma pantalla (según la **Decisión abierta 1** que elijas abajo).
- La cabecera superior deja máximo 3 iconos a la derecha (Claude, Sincronizar y Ajustes); el filtro (`Todas / Pendientes / Completadas`) pasa a una línea compacta junto al contador de tareas.
- Se funden la tarjeta «Hoy: 0 de 3» y el texto suelto «7 pendientes de 8» en una sola franja limpia, sin encerrar la barra en otra tarjeta más, animando la barra con `scaleX()`.
- En cada tarea: casilla de `22px` con borde neutro (`--faint`), prioridad como punto de `8px` (o borde izquierdo de `3px` si elegiste «Borde» en Ajustes), fecha y avisos en tamaño legible (`--text-sm`, `14px`), y vencidas en rojo `--high` diciendo explícitamente `Vencida · 13 nov`.
- El botón de opciones `⋮` pasa de ser un carácter de texto con estilo suelto a un icono SVG limpio de `22px`.

**Por qué:**
- §1 Lista negra, §2 Color/Tipografía y §3 Componentes de `art-direction` (+ `emil-design-eng` y `apple-design` *Hierarchy*): un solo botón primario por pantalla, máximo 3 iconos en cabecera, metadatos en `--text-sm` y nada que dependa solo del color para indicar que venció.

**Detalle técnico:**
- **Archivos y selectores:**
  - `index.html`: `#open-filter` (`34-37`, integrar en la barra de estado de `#tab-tasks` manteniendo `id="open-filter"` y `#filter-badge` para no romper `app.js:202, 311, 526` ni `push-client.js:40`). En `#task-empty` (`68`), cambiar a línea `--text-sm` `--muted` con acción para anotar.
  - `app.js`: en `taskHTML` (`264-275`), mostrar `.dot` de `8px`, incluir `overdue ? "Vencida · " + dueLabel(t.due) : dueLabel(t.due)` en `.due-label`, y reemplazar el carácter `⋮` (`274`, `style="font-size:1.4rem;font-weight:700"`) por `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>`.
  - `home.js`: en `renderTaskProgress()` (`157-168`), cambiar `<span style="width:${pct}%...">` por `<span style="--p:${pct / 100}">` con `transform: scaleX(var(--p, 0)); transform-origin: left` y `background: var(--accent)` (quitar `--grn-mid` y `.day-progress.all-done { background: var(--grn-bg) }` de `tablero.css:142-143`).
  - `tablero.css` y `styles.css`: `.task-item input[type="checkbox"]` (`tablero.css:114-129` → `width: 22px; height: 22px; border: 2px solid var(--faint)`), quitar `.task-item .dot { display: none }` (`tablero.css:128`) para que `.dot` (`width: 8px; height: 8px`) se vea cuando el estilo es `dot`, `.due-label` (`styles.css:137` → `font-size: var(--text-sm)`), `.due-label.overdue, .group-head.overdue` (`tablero.css:131, 133` → `color: var(--high)`).

---

### 03. Rutina — Hoy

**Qué se cambia:**
- Los hábitos de cada grupo (`HOY`, `ESTA SEMANA`, `ESTE MES`) dejan de estar encerrados cada uno en su propia tarjeta individual con borde; pasan a ser filas limpias separadas por una línea fina de `1px` dentro de una sola superficie por grupo (igual que en Pendientes).
- Se quita de la vista «Hoy» la segunda tarjeta repetida «Tu semana 40 %» con los 7 circulitos (para ver la semana ya está la pestaña «Resumen semanal» justo arriba). *(Nota: revisar impacto en `tests/routine-e2e.js:49-64` en el Bloque 2)*.
- Las casillas marcadas y la barra de avance pasan del verde `--grn-mid` al azul cobalto único de la app (`--accent`), con tamaño `22px` y sin quedarse infladas (`scale(1.06)`).
- Las pastillas naranjas junto a cada hábito que hoy dicen `2 días` o `3 días` (que en `app.js:2356, 2362` y `routine.js:187` significan la **racha de días seguidos cumpliendo ese hábito diario**, pero parecen indicar cuántos días faltan o cada cuánto toca) pasan a ser texto tranquilo en `--text-xs --muted` que diga **`3 días seguidos`** (o se integran en el subtítulo del hábito: `lunes a viernes · 3 días seguidos`), quitando el fondo naranja `--fire-bg` repetido en cada fila.
- En el estado vacío, se quita la tarjeta con el párrafo largo y el botón azul gigante `+ Añadir mi primer pendiente` (que competía con `+ Anotar`), dejando una línea simple con acción en texto.

**Por qué:**
- §1 Lista negra, §2 Color/Superficies y §3 Componentes de `art-direction` (+ `impeccable` *Clarify/Distill* y `emil-design-eng`): las listas son filas con divisores de `1px`, `--accent` es el único color para casillas marcadas, y ningún rótulo debe obligar a adivinar qué significa («2 días» → «2 días seguidos»).

**Detalle técnico:**
- **Archivos y selectores:**
  - `app.js`: en `routineTodayHTML()` (`2296-2342`), estado vacío (`2299-2305`) en una línea `--text-sm` `--muted` con `<button class="link-accent" data-action="rt-add">Crear hábito</button>` (conservando `data-action="rt-add"`). En `2335`, barra `.rt-bar span` con `style="--p:${pct / 100}"`. En modo edición (`2341`), cambiar `.btn-primary` de `+ Añadir pendiente` a `.btn-secondary`. En `routineRowHTML()` (`2344-2365`), cambiar `↑`, `↓`, `✎` (`2351-2353`) por iconos SVG de `22px` (`stroke-width="2"`), y en `2362` cambiar `<span class="rt-streak" title="Días seguidos">${streak} días</span>` por `<span class="rt-streak">${streak} días seguidos</span>` (en `--text-xs` `--muted`, sin pastilla naranja) o quitarla si ya se muestra la racha general arriba.
  - `styles.css` y `tablero.css`: `.rt-list` (`styles.css:439` → `gap: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden`), `.rt-item` (`styles.css:440`, `tablero.css:170` → `border: 0; border-top: 1px solid var(--border); border-radius: 0`), `.rt-item:first-child { border-top: 0 }`, `.rt-check` (`styles.css:444`, `tablero.css:172-173` → `width: 22px; height: 22px; border: 2px solid var(--faint)` y `.rt-item.done .rt-check { background: var(--accent); border-color: var(--accent); color: var(--on-accent); transform: none }`), `.rt-bar span` (`tablero.css:169` → `background: var(--accent); width: 100%; transform-origin: left; transform: scaleX(var(--p, 0)); transition: transform var(--dur-base) var(--ease-out)`), `.rt-streak` (`styles.css:450`, `tablero.css:175` → `background: transparent; color: var(--muted); font-size: var(--text-xs); font-weight: 500; padding: 0`).

---

### 04. Rutina — Resumen semanal

**Qué se cambia:**
- **Celdas sin cruces ni colores de castigo (Hueco 4c):** Hoy, los días pasados sin marcar salen con una `✕` naranja/roja (`.c-miss`), y los hábitos semanales/mensuales vencidos también muestran `✕` en rojo. Incluso en las capturas (`04-rutina-semana-cel-claro-lleno.png`), lunes, martes y miércoles salen llenos de cruces `✕` porque el hábito se creó antes sin registros de esos días. Se eliminan por completo las cruces `✕` y los tonos rojos/naranjas (`--danger` y `--fire`):
  - **Hecho (`done`):** punto lleno de color azul cobalto (`--accent`).
  - **No hecho pasado (`miss`) u hoy pendiente (`pending`):** anillo vacío con borde suave (`--border`, o borde `--accent` tenue en hoy) sin cruz.
  - **Futuro (`future`) o día en que no existía / no tocaba (`na`):** nada (espacio limpio o punto minúsculo `--border` decorativo), para nunca avergonzar ni mostrar como fallo días sin datos o previos a que existiera el hábito.
- **Tamaño táctil en el celular:** Cada día de la cuadrícula (`L M X J V S D`) pasa de medir `24×26px` a tener un área táctil cómoda (≥ `36–44px` de alto con `gap: 4px`), poniendo el nombre del hábito encima en pantallas estrechas o dándole el alto táctil a la fila.
- **Limpieza de tarjetas y vacíos:** El porcentaje semanal (`40 % · 10 de 25 cumplidos`) se integra con sobriedad sin el color verde `--grn` chillón; la caja azul «Comentario de la semana» se oculta cuando aún no hay comentario de Claude; y si la rutina está vacía o la semana no tiene datos, se muestra una única línea tranquila en lugar de 5 bloques vacíos seguidos.
- Las flechas para cambiar de semana (`‹` y `›`) pasan a ser iconos SVG de `22px`.

**Por qué:**
- §1 Lista negra, §2 Color/Geometría y §3 Componentes de `art-direction` (+ `apple-design` *Responsibility/Delight* y `mobile-native` objetivos táctiles): la interfaz debe acompañar sin castigar con cruces rojas/naranjas los días sin registro, respetar la regla 60/30/10 (`--accent` único) y permitir tocar cada día con el pulgar sin equivocarse.

**Detalle técnico:**
- **Archivos y selectores:**
  - `app.js`: en `RT_CELL` (`2367`), cambiar `{ done: "✓", miss: "✕", pending: "", future: "", na: "–" }` a `{ done: "", miss: "", pending: "", future: "", na: "" }` (la representación visual la hace el CSS con punto lleno o anillo vacío, mientras el `title` y `aria-label` conservan `RT_CELL_LABEL` para accesibilidad). En `routineWeekHTML()` (`2375`), cambiar `<span>${r.done ? "✓" : r.closed ? "✕" : "○"}</span>` para no usar `✕` ni clase `.bad` roja (usar punto lleno en `.ok` y anillo vacío en no hecho). En `2392, 2397`, usar SVG chevron en `.icon-btn`. En `2409-2412`, ocultar el bloque de comentario vacío con CSS o renderizado condicional (ojo: `tests/routine-e2e.js:74` verifica `assert((await p.locator('.rt-review').innerText()).includes('Aún no hay comentario'))`, por lo que en el Bloque 2 se actualiza esa línea del test o se deja `.rt-review` como una sola línea `--text-sm --muted` sin tarjeta `--ind-bg`).
  - `styles.css` y `tablero.css`:
    - `.rt-grid-row i` (`styles.css:466-471`, `tablero.css:181-182`): convertir el indicador visual en un círculo centrado (`::after` de `14×14px`, `border-radius: var(--radius-pill)`) dentro de una celda táctil de `min-height: 36px`:
      - `i.c-done::after`: `background: var(--accent); border: 2px solid var(--accent)`.
      - `i.c-miss::after`: `background: transparent; border: 2px solid var(--border)` (anillo vacío, sin naranja ni rojo).
      - `i.c-pending::after`: `background: transparent; border: 2px solid var(--faint)` (hoy sin marcar).
      - `i.c-future::after, i.c-na::after`: `display: none` (nada en días futuros, en días que no tocaba o anteriores a `item.createdAt` según `existedOn` en `routine.js:149, 207`).
    - En la tarjeta `.rt-week-card` (si se usa en algún lugar): `.rt-dot.d-full i { background: var(--accent) }`, `.rt-dot.d-miss i { background: transparent; border-color: var(--border) }`, `.rt-dot.d-future i, .rt-dot.d-empty i { border-color: transparent; background: transparent }`.
    - `.rt-pct` (`tablero.css:184` → `color: var(--text)`), `.rt-review` (`tablero.css:185` → `background: var(--surface); border: 1px solid var(--border)`).

---

### 05. Trabajo — Oportunidades

**Qué se cambia:**
- Se eliminan las 3 cajas iguales del embudo (`2 Por revisar`, `1 Apliqué`, `0 Me respondieron`) con números gigantes de colores y se muestra en su lugar la línea limpia que ya existe en el código (`2 por revisar · 1 aplicada · 0 con respuesta`).
- El botón azul gigante de ancho completo `+ Añadir oportunidad` pasa a ser un botón secundario compacto (`--surface-2`), dejando a **«+ Anotar»** como el único botón primario azul (`--accent`) de la pantalla.
- Se evita apilar dos barras segmentadas grandes una debajo de otra (`Oportunidades | Ingresos` y `Activas | Todas`): `Activas / Todas` pasa a ser un filtro ligero de chips junto al resumen de conteo, para que las ofertas suban al primer pantallazo.
- En cada oferta, el botón de estado (`Por revisar ▾`) sube su altura táctil a `44px`, el lápiz de editar `✎` pasa a ser un icono SVG de `22px`, y las ofertas se ordenan como filas separadas por `1px` dentro de una lista limpia.
- En estado vacío, queda una sola línea en `--text-sm --muted` (`Aún no hay oportunidades. · Añadir oportunidad`).

**Por qué:**
- §0.3 Densidad, §1 Lista negra («three feature cards», ceros grandes, dos botones primarios) y §2 Geometría de `art-direction` (+ `impeccable` *Distill* y `mobile-native`).

**Detalle técnico:**
- **Archivos y selectores:**
  - `app.js`: en `renderWork()` (`2545-2586`), quitar `.wk-funnel` (`2575-2579`), cambiar `class="btn-primary w-full py-3"` en `[data-action="wk-add"]` (`2572`) a `class="btn-secondary"`, reemplazar `✎` (`2567`) por SVG de editar (`22px`, `stroke-width="2"`). Conservar `#work-count` (`2574`) y `#work-filter` (`2580-2583`) con sus `data-all="0"` y `data-all="1"` para que `tests/work-e2e.js:31, 52-54` siga pasando sin romperse.
  - `tablero.css` y `styles.css`: eliminar `.wk-funnel` y la regla `#work-count { position: absolute; clip: rect(0 0 0 0)... }` (`tablero.css:189-197`) para que `#work-count` se vea en `font-size: var(--text-sm); color: var(--muted); font-variant-numeric: tabular-nums`. Estilizar `#work-filter` como fila compacta de chips (`background: transparent; padding: 0; gap: 0.5rem`). En `.wk-status` (`styles.css:503`), subir a `min-height: 44px; padding: 0 0.85rem; font-size: var(--text-sm)`. En `.wk-close.soon` (`tablero.css:203`), usar `color: var(--medium)` y en `.wk-close.late` (`204`) usar `color: var(--high)`, quitando el borde interior naranja `.wk-card:has(.wk-close.soon)` (`205`). Unificar `.wk-list` como contenedor `--surface` con `border: 1px solid var(--border); border-radius: var(--radius-lg); gap: 0` y `.wk-card` con `border: 0; border-top: 1px solid var(--border); border-radius: 0`.

---

### 06. Trabajo — Ingresos

**Qué se cambia:**
- Cuando un mes no tiene ingresos registrados (estado vacío), se oculta el bloque gigante que grita **`$ 0`** (`Con Claude $ 0 · Presencial $ 0`) y se muestra una sola línea tranquila debajo del selector de mes (`No hay ingresos en noviembre 2026. · Añadir ingreso`).
- El botón azul de ancho completo `+ Añadir ingreso` pasa a ser un botón secundario (`--surface-2`), dejando a **«+ Anotar»** como único botón primario azul (`--accent`).
- Los pagos del mes (`.inc-row`) pasan de ser tarjetas sueltas a filas limpias separadas por una línea fina de `1px` dentro de una sola tarjeta `--surface`.
- La fecha y el tipo de cada pago (`14 nov · Presencial`) suben de `12px` (`--text-xs`) a `14px` (`--text-sm`) para leerse con comodidad, y las flechas de mes (`‹` y `›`) pasan a ser iconos SVG de `22px`.

**Por qué:**
- §1 Lista negra (prohibidos los ceros grandes en estados vacíos, las listas en tarjetas individuales y dos botones primarios) y §2 Tipografía de `art-direction`.

**Detalle técnico:**
- **Archivos y selectores:**
  - `app.js`: en `renderIncome()` (`2589-2611`), cambiar `text-xs` a `text-sm` en `2594`, reemplazar `‹` y `›` (`2599, 2601`) por SVG chevron de `22px`, cambiar `.btn-primary` en `[data-action="inc-add"]` (`2608`) a `.btn-secondary`. Cuando `t.count === 0`, ocultar visualmente `.inc-total` (o añadir clase `.is-empty` en `.inc-total` que oculte el `$ 0` gigante o dejar `#inc-total` oculto para pantalla pero en DOM si `tests/income-e2e.js:22` consulta `#inc-total`; ver Bloque 3).
  - `styles.css`: `.inc-list` (`517` → `gap: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden`), `.inc-row` (`518` → `border: 0; border-top: 1px solid var(--border); border-radius: 0; padding: 12px 16px`), `.inc-row:first-child { border-top: 0 }`.

---

### 07. Resúmenes (lista + «Leyendo ahora»)

**Qué se cambia:**
- **Arreglo de palabras cortadas (Hueco 4a):** En la tercera tarjeta (`Cien años de soledad, edición conmemorativa…`), la palabra se parte hoy como `conmemorativ / a` porque `styles.css:304` tiene `overflow-wrap: anywhere` dentro de una tarjeta estrecha. Como `index.html:2` ya tiene `<html lang="es">`, se cambia a `overflow-wrap: break-word; hyphens: auto` y se limita el título en la tarjeta a 3 líneas (`-webkit-line-clamp: 3`), evitando que una letra quede colgada sola.
- Se elimina el efecto de «tarjeta dentro de tarjeta» en cada libro (hoy hay una caja blanca `.book-card` con borde que encierra adentro otra caja coloreada `.book-open` con sombra dura incluso en modo oscuro), dejando una sola superficie limpia sin sombra exterior y quitando el giro `rotate(-0.5deg)` al tocar.
- La pastilla activa del filtro (`Todos 3`) deja de pintarse de negro en modo claro y blanco en modo oscuro; pasa a usar el mismo estilo limpio del resto de la app (`--surface` con borde interior de `2px` en `--accent`).
- El botón superior `+ Nuevo resumen de libro` pasa a botón secundario (`--surface-2`) o se oculta `+ Anotar` en esta pestaña para no tener dos botones azules `--accent` a la vez.
- En el estado vacío, se quitan los signos de exclamación de plantilla (`¡Crea el primero!`) y queda `Aún no tienes resúmenes. · Crear resumen`.
- Las barras de lectura pasan de animar `width` a usar `transform: scaleX()`.

**Por qué:**
- §0.4 Estados (texto larguísimo), §1 Lista negra (no tarjetas dentro de tarjetas, no sombras en oscuro, no exclamaciones de plantilla) y §4 Movimiento de `art-direction` (+ `impeccable` *Typeset/Polish* y `emil-design-eng`).

**Detalle técnico:**
- **Archivos y selectores:**
  - `index.html`: `#new-book` (`87` → `class="btn-secondary w-full py-3"`), `#book-empty` (`91` → `Aún no tienes resúmenes. · <button type="button" class="link-accent" data-action="new-book-empty">Crear resumen</button>`).
  - `app.js`: en `readingBarHTML()` (`1936-1938`), cambiar `<i style="width:${r.pct}%">` por `<i style="--p:${r.pct / 100}">`.
  - `styles.css` y `tablero.css`:
    - En `.book-row-title` (`styles.css:304, 570`, `tablero.css:221`): cambiar `overflow-wrap: anywhere` por `overflow-wrap: break-word; hyphens: auto; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden`. Hacer lo mismo en `.book-row-author` (`overflow-wrap: break-word`).
    - En `.book-card` (`tablero.css:212`): `padding: 0; background: transparent; border: 0`.
    - En `.book-open` (`tablero.css:213-220`): `box-shadow: inset 6px 0 0 rgb(0 0 0 / 0.16)` (quitar la sombra exterior `0 6px 14px rgb(16 24 40 / 0.12)`), `:active { transform: scale(0.98) }` (quitar `rotate(-0.5deg)`).
    - En `.bk-chip.active` (`styles.css:567`): `background: var(--surface); color: var(--text); box-shadow: inset 0 0 0 2px var(--accent); font-weight: 600`.
    - En `.read-bar i` (`styles.css:556`): `width: 100%; transform-origin: left; transform: scaleX(var(--p, 0)); transition: transform var(--dur-base) var(--ease-out)`.

---

### 08. Página de un libro (y página de notas)

**Qué se cambia:**
- El carril de puntos de navegación a la derecha (`.dot-rail`) solo se muestra cuando el resumen libre tiene **2 o más títulos** (`h1`); cuando solo hay 1 título, no se dibuja un punto azul solitario que no lleva a ningún otro lado.
- En el panel de lectura («Capítulo 7 de 20»), se quitan las flechitas internas del campo numérico `20` para que el número quede centrado y el campo mida `44px` de alto táctil, y los botones `−`, `+` y `←` (volver) pasan a ser iconos SVG de trazo de `22px`.
- El texto de lectura del resumen en modo «Libre» pasa a usar la letra con serifa (`Georgia`, `--font-serif`) con interlineado cómodo (`1.6`), igual que ya lo hace el modo «Por bloques».
- En modo lectura «Por bloques», los cuadros donde aún no hayas escrito nada se ocultan (o usan `--muted` en vez de `--faint` ilegible) para no mostrar 4 veces seguidas «Sin contenido».

**Por qué:**
- §2 Tipografía (`--font-serif` para leer resúmenes, `tabular-nums`), §2 Color (`--faint` nunca para texto de lectura, `--accent` no en puntos decorativos sueltos) y §2 Geometría (`44×44px`) de `art-direction` (+ `apple-design` *Typography*).

**Detalle técnico:**
- **Archivos y selectores:**
  - `index.html`: reemplazar `←` en `#notes-back` (`280`) y `#book-back` (`293`) por `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`.
  - `app.js`: en `fillNotes()` (`1823`), reemplazar el emoji `📅` por `META_ICON.cal`. En `freeViewHTML()` (`1869`), cambiar `const rail = titles.length ?` por `const rail = titles.length >= 2 ?`. En `readingPanelHTML()` (`2004, 2007`), cambiar `−` y `+` por SVG de `20px` (`stroke-width="2"`).
  - `styles.css`: en `.chap-total` (`582`), `min-height: 44px; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield` y `.chap-total::-webkit-inner-spin-button, .chap-total::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0 }`. En `#book-detail .free-body .doc .blk[data-type="p"]`, añadir `font-family: var(--font-serif); font-size: var(--text-lg); line-height: 1.65; max-width: 65ch`. En `.box .empty` (`183`), cambiar `color: var(--faint); font-style: italic` por `color: var(--muted); font-size: var(--text-sm); font-style: normal`.

---

### 09. Ajustes

**Qué se cambia:**
- **Fusión del permiso de notificaciones en el interruptor (Punto 3):** Hoy aparece el interruptor «Recibir recordatorios aquí» encendido en azul y, justo debajo, un botón grande «Permitir notificaciones» (`#enable-notif`), lo cual confunde porque parece que ya estaba activo. Pero no se puede borrar la petición de permiso porque el navegador exige un toque del usuario (`Notification.requestPermission()`). **Solución:** se elimina el botón suelto `#enable-notif` y se fusiona todo en el interruptor **«Recibir recordatorios aquí»** (`#notify-switch`):
  - El interruptor solo se muestra encendido (`aria-checked="true"`) cuando `state.settings.notifyHere` es verdadero **y** el permiso del navegador no está denegado ni pendiente (`Notification.permission === "granted"`).
  - Al encender el interruptor, si el permiso está en `"default"`, se pide de inmediato `await Notification.requestPermission()` dentro de ese mismo toque.
  - Si el usuario niega el permiso (o ya estaba en `"denied"`), el interruptor vuelve a apagado (`aria-checked="false"`) y debajo aparece una sola línea en `--text-xs --muted` (`#notify-status`) que explica cómo activarlo: *«Permiso bloqueado en el navegador. Actívalo en el candado de la barra de direcciones.»*.
- La tarjeta «Sincronizar mis dispositivos» deja de tener título gigante (`18px`) y botón desproporcionado (`56px`), integrándose con el tamaño normal de las opciones (`16px`) y botones de `48px`.
- Los subtítulos en mayúsculas (`AVISOS EN ESTE DISPOSITIVO`, `WIDGET DE ANDROID`) bajan de `14px` a `12px` (`--text-xs`) para no gritar más que los controles.
- Se quitan los caracteres sueltos (`●`, `▌`, `▾`, `✕`, `🔔`) usando iconos SVG de trazo de `22px`, y el asa superior de las hojas pasa a `36×4px`.

**Por qué:**
- §1 Lista negra (cero emojis `🔔`, cero botones redundantes), §2 Tipografía (`--text-xs` en etiquetas en mayúsculas) y §3 Componentes de `art-direction` (+ `apple-design` *Responsibility*: pedir permisos en el momento exacto de la acción del usuario).

**Detalle técnico:**
- **Archivos y selectores:**
  - `index.html`: en `#settings` (`171-233`), reemplazar `✕` (`175`) por SVG de cerrar, quitar `● ` y `▌` de los botones `priorityStyle` (`186-187`), reemplazar `<button id="enable-notif" ...></button>` (`204`) por `<p id="notify-status" class="muted text-xs hidden" role="status"></p>`, y reemplazar `▾` (`214`) por SVG chevron. (Reemplazar también `✕` en `#routine-sheet-close` `131`, `#work-sheet-close` `142`, `#chapter-sheet-close` `161` y `#rem-close` `252`).
  - `app.js`: revisar `renderSettings()` (`689-700`) y el listener de `#notify-switch` (`757-765`) + eliminar el listener de `#enable-notif` (`744-748`):
    - En `renderSettings()`:
      ```js
      const perm = "Notification" in window ? Notification.permission : "unsupported";
      const on = !!state.settings.notifyHere && perm === "granted";
      $("#notify-switch").setAttribute("aria-checked", String(on));
      $("#notify-switch").disabled = perm === "unsupported";
      const ns = $("#notify-status");
      if (ns) {
        const msg = perm === "unsupported" ? "Este navegador no admite notificaciones."
          : perm === "denied" ? "Permiso bloqueado. Actívalo en el icono de candado o ajustes de sitio del navegador." : "";
        ns.textContent = msg;
        ns.classList.toggle("hidden", !msg);
      }
      ```
    - En `#notify-switch` click (`757-765`): cuando pasa a encendido y `Notification.permission === "default"`, llama `await Notification.requestPermission()`; si el resultado no es `"granted"`, deja `state.settings.notifyHere = false`, guarda y llama `renderSettings()` y `runReminders()`. *(Nota: en `tests/sync-e2e.js:14` y `tests/full4.js:5`, el contexto de Playwright ya concede `permissions: ['notifications']`, por lo que `Notification.permission` es `'granted'` y el test de `#notify-switch` en `sync-e2e.js:97` sigue funcionando idéntico)*.
  - `styles.css` y `tablero.css`: `.settings-title` (`styles.css:346` → `font-size: var(--text-xs); font-weight: 600; letter-spacing: 0.06em`), `.sync-title` (`styles.css:372` → `font-size: var(--text-base); font-weight: 600`), `.sync-card .sync-actions > .btn-primary` (`styles.css:373` → `min-height: 48px; font-size: var(--text-base)`), `.sheet::before` (`tablero.css:93` → `width: 36px; height: 4px`).

---

### 10. Hoja de Claude

**Qué se cambia:**
- El botón `📞 Llamar a Claude (voz)` quita el emoji `📞` y el fondo verde brillante suelto (`#16a34a`), pasando a usar un icono SVG de teléfono y el estilo de botón secundario con tokens (`--surface-2`, `--text`, `--radius-md`), para que `Dejar encargo` sea el único botón primario azul (`--accent`) de la hoja.
- Cuando aún no has conectado tu código de sincronización, se oculta el segundo párrafo repetitivo del pie (`.claude-foot`) para dejar una explicación limpia en una sola vista.
- Las burbujas de mensajes cambian sus esquinas de `0.3rem` (valor suelto) al token `--radius-sm` (`8px`), y el botón de cerrar `✕` pasa a ser un icono SVG de `22px`.

**Por qué:**
- §1 Lista negra (cero emojis, cero colores hexadecimales sueltos fuera de `:root`, un solo botón primario por pantalla) y §2 Geometría de `art-direction`.

**Detalle técnico:**
- **Archivos y selectores (sin tocar `calllogic.js` ni la lógica de `calls.js`):**
  - `index.html`: en `#close-claude` (`330`), reemplazar `✕` por SVG de cerrar (`22px`). En `#claude-call` (`351`), reemplazar `📞 Llamar a Claude (voz)` por `<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>Llamar a Claude (voz)</span>`.
  - `calls.css`:
    - `.msg` (`7` → `border-radius: var(--radius-md)`), `.msg.theirs` (`10` → `border-bottom-left-radius: var(--radius-sm)`), `.msg.mine` (`11` → `border-bottom-right-radius: var(--radius-sm)`).
    - `.btn-call` (`20-21` → `display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-md); font-weight: 600; min-height: 48px; transition: transform var(--dur-fast)` y `.btn-call:active { background: var(--border); transform: scale(0.98) }`).
    - Ocultar pie redundante cuando no está conectado: `#claude-sheet:has(#claude-compose.hidden) .claude-foot { display: none }`.

---

### Transversal: Botón flotante «+ Anotar» y espacio final de las listas (Hueco 4d)

**Qué se cambia:**
- En todas las pantallas (tanto en celular como en computador), se asegura un espacio libre al final del contenido principal (`.app-main`) para que el botón flotante **«+ Anotar»** nunca tape el último elemento de una lista (como hoy ocurre con la segunda oferta en Trabajo, el tercer libro en Resúmenes o el final de Inicio).
- Todos los botones primarios, secundarios y el botón «+ Anotar» unifican su redondeo a `--radius-md` (`12px`), reservando `--radius-lg` (`16px`) para las tarjetas y hojas.

**Por qué:**
- §2 Geometría (`--radius-md` 12px en botones) y §5 Accesibilidad y celular de `art-direction` (+ `mobile-native` §7 *safe areas* y contenedores con barra fija): ningún control flotante puede impedir tocar o leer el último ítem de una lista.

**Detalle técnico:**
- **Causa exacta en código:** En celular (`styles.css:407`), `.app-main` tiene `padding-bottom: calc(10.5rem + env(safe-area-inset-bottom))`, que sí alcanza en pantallas cortas, pero en pantallas donde el contenido llena justo el primer pantallazo sin hacer scroll (como `05-trabajo-ofertas-cel-claro-lleno.png` o `07-resumenes-cel-claro-lleno.png`), la tarjeta cae en la esquina inferior derecha (`bottom: 4.9rem` a `8.15rem`), exactamente detrás de `.qc-fab`. Y en computador (`≥1024px`, `tablero.css:334`), `.app-main` sobrescribe el padding con `padding: 1.25rem 2rem 4rem` (`64px`), que es menor que la altura del FAB (`52px` + `24px` de margen inferior + `16px` de holgura = `92px`).
- **Arreglo concreto con tokens:**
  - En `styles.css:59, 407` y `tablero.css:334`: definir `--fab-space: calc(56px + 3.25rem + 1rem + env(safe-area-inset-bottom, 0px))` (barra inferior `56px` + altura del FAB `52px` + `16px` de separación + `safe-area`, con holgura extra cuando se abre la barra de formato) en móvil, y en `@media (min-width: 1024px)` subir `padding-bottom` de `.app-main` de `4rem` a `calc(3.25rem + 2.5rem + env(safe-area-inset-bottom, 0px))` (`≥ 92px`), garantizando que al hacer scroll hasta el final ninguna tarjeta ni botón de editar quede detrás de `#qc-fab`.
  - En `tablero.css:84, 86`, `tablero.css:209` (`#new-book`) y `capture.css:9` (`.qc-fab`): cambiar `border-radius: var(--radius-lg)` a `border-radius: var(--radius-md)` (`12px`, `height: 48px`).

---

## Decisiones abiertas para el dueño

Estas dos decisiones tocan cosas que ya habías visto o que forman parte de tu gusto personal. Te damos las dos opciones con sus ventajas reales para que elijas cuál prefieres en cada una:

### Decisión 1: El cuadro «Nueva tarea…» arriba en Pendientes (en el celular)
En la Parte B aprobaste que el cuadro de escribir tarea en Pendientes fuera compacto (de una sola línea) y mostrara la prioridad y fecha solo al empezar a escribir. Sin embargo, ahora también existe el botón flotante **«+ Anotar»** abajo a la derecha, por lo que en Pendientes hoy se ven dos botones azules (`+` arriba y `+ Anotar` abajo).

- **Opción A:** **Mantener el cuadro compacto «Nueva tarea…» arriba en Pendientes y ocultar el botón flotante «+ Anotar» solo cuando estés en la pestaña Pendientes** (en las demás pestañas «+ Anotar» sigue visible; y el botón `+` del cuadro solo se pinta de azul cuando escribes algo).
  - *Medición en celular (`390×844`):* **1 toque** para empezar a escribir una tarea; caben **4 a 5 tareas** visibles sin hacer scroll. No rompe la prueba automática `tests/pendientes-e2e.js`.
- **Opción B:** **Quitar el cuadro «Nueva tarea…» en el celular (dejándolo solo en el computador a la izquierda) y usar siempre el botón flotante «+ Anotar»** para crear tareas con frases rápidas como «mañana pagar luz !».
  - *Medición en celular (`390×844`):* **1 toque** en «+ Anotar» (el teclado se abre solo); ganas `~84px` verticales y caben **6 a 7 tareas** visibles sin hacer scroll, pero pierdes los botones directos de formato (negrita/color) al crear la tarea desde el formulario.
- **Recomendación del equipo (Claude + Gemini):** **Opción A** si usas mucho el formato de texto o los chips de «Hoy / Mañana» al crear tareas en Pendientes; **Opción B** si prefieres ver más tareas de un vistazo y anotar todo con «+ Anotar». *(Por defecto en el código preparado dejamos lista la Opción A para no quitar lo que ya habías aprobado en §10b hasta que nos confirmes).*

### Decisión 2: El anillo de progreso en «Tu día» (Inicio) y en «Rutina» (cuando sí hay datos)
Estamos de acuerdo en que cuando el día está vacío **nunca** debe salir un anillo con «0 %». La duda es qué prefieres ver cuando **sí** tienes tareas o hábitos para hoy:

- **Opción A:** **Conservar un anillo pequeño y discreto (`≤ 64px`) en azul cobalto (`--accent`) sin cifra gigante adentro**, acompañado a la derecha por el texto `2 de 8 hechos`.
  - *Ventaja:* Mantiene la identidad visual del anillo que te gusta, pero ocupa la mitad de espacio que el actual de `112px` y deja que las 3 tareas importantes se vean completas en el primer pantallazo.
- **Opción B:** **Quitar el anillo por completo y dejar solo el texto `2 de 8 hechos` con una línea fina horizontal (`4px`)** que avanza suavemente de izquierda a derecha (`scaleX`).
  - *Ventaja:* Es la opción más limpia y rápida de leer, ahorra `~56px` adicionales de altura en el celular y unifica el estilo con todas las demás barras de la app.
- **Recomendación del equipo (Claude + Gemini):** **Opción B** por limpieza y espacio para las tareas en la pantalla del celular; pero si el anillo te gusta como sello visual del Inicio, la **Opción A** (`56–64px`, un solo color `--accent`, sin número gigante) funciona muy bien y respeta todas las reglas de diseño.

---

## Desacuerdos Claude–Gemini y cómo se resolvieron

1. **Quitar el formulario `#task-form` en Pendientes móvil:**
   - *Postura inicial de Gemini (Ronda 1):* Eliminar `#task-form` en móvil porque duplica la función del botón flotante `+ Anotar` y ocupa espacio antes de la lista.
   - *Objeción de Claude (Ronda 2):* El dueño ya había aprobado en `NOTAS.md §10b` el comportamiento compacto de `#task-form` (que despliega prioridad y fecha solo al escribir) y además `tests/pendientes-e2e.js` prueba específicamente ese flujo.
   - *Resolución:* Claude tiene razón en respetar lo aprobado por el dueño. No lo decidimos nosotros: se eleva a la **Decisión abierta 1** con métricas exactas de toques y tareas visibles. En ambos casos se elimina el choque de dos botones azules primarios simultáneos (en A ocultando `#qc-fab` en `body[data-tab="tasks"]`, en B ocultando `#task-form` en móvil).

2. **Eliminar el anillo `.ring` en Inicio y Rutina:**
   - *Postura inicial de Gemini (Ronda 1):* Eliminar el anillo tanto en vacío como en lleno y usar solo una barra fina `scaleX()`.
   - *Objeción de Claude (Ronda 2):* Quitarlo en vacío es obligatorio (regla anti «0 %»), pero en lleno forma parte de la identidad visual del tablero que le gusta al dueño.
   - *Resolución:* En estado vacío se elimina por completo. Para el estado con datos, se presenta al dueño la **Decisión abierta 2** entre el anillo compacto (`≤ 64px` en `--accent` sin porcentaje gigante) y la barra fina horizontal (`4px` con `scaleX()`).

3. **El botón «Permitir notificaciones» en Ajustes:**
   - *Postura inicial de Gemini (Ronda 1):* Quitar `#enable-notif` y pedir el permiso desde `#notify-switch`.
   - *Puntualización técnica de Claude (Ronda 2):* Verificar `app.js:691` y `app.js:744-765` para que el permiso del navegador (que exige gesto directo del usuario) y el estado bloqueado (`denied`) no queden mudos si se quita el botón.
   - *Resolución:* Verificado en `app.js:689-700` y `757-765`: hoy `#notify-switch` ya llama a `Notification.requestPermission()` cuando el permiso es `"default"`, pero el interruptor se quedaba pintado en azul aunque el usuario negara el permiso o estuviera pendiente. Acordamos fusionar todo en `#notify-switch`: solo se muestra encendido si `notifyHere && Notification.permission === "granted"`, pide el permiso en el gesto de encenderlo, y si el navegador lo tiene bloqueado (`"denied"`), apaga el interruptor y muestra una línea `--text-xs --muted` indicando cómo activarlo en el navegador.

4. **Cuatro huecos visuales detectados por Claude en Ronda 2:**
   - *Palabra cortada `conmemorativ / a` en 07 Resúmenes:* Confirmado en `styles.css:304` (`overflow-wrap: anywhere`) y `07-resumenes-cel-claro-lleno.png`. Se resuelve con `overflow-wrap: break-word; hyphens: auto` (aprovechando `<html lang="es">` en `index.html:2`) + `-webkit-line-clamp: 3`.
   - *Pastillas `2 días` / `3 días` en 03 Rutina Hoy:* Confirmado en `app.js:2356, 2362` y `routine.js:187-196`: calculan la racha (`Routine.streak`), pero el texto `"2 días"` sin contexto es ambiguo. Se cambia a texto claro `"2 días seguidos"` en `--text-xs --muted` (o se quita el chip naranja).
   - *Cruces `✕` en días previos o sin datos en 04 Semana:* Confirmado en `app.js:2367, 2375`, `tablero.css:182` y `04-rutina-semana-cel-claro-lleno.png`. Se eliminan todas las cruces `✕` y colores rojos/naranjas: hecho = punto lleno `--accent`; no hecho pasado = anillo vacío `--border`; futuro o sin datos (`na`, previo a `createdAt`) = vacío.
   - *Solapamiento del botón flotante `+ Anotar`:* Confirmado en `01`, `02`, `05` y `07` y en `tablero.css:334`. Se corrige asegurando en `.app-main` un `padding-bottom` mayor a la altura del FAB + barra inferior + `16px` + `env(safe-area-inset-bottom)`.

---

## Orden de trabajo por bloques

Para que puedas revisar y aprobar los cambios paso a paso sin riesgo de romper la aplicación, dividimos el trabajo en **4 bloques ordenados de menor riesgo / mayor impacto transversal a cambios por sección**:

### Bloque 1: Transversal barato y seguro (CSS, tokens, barras, espacio del FAB e icono de la app)
- **Qué incluye:**
  1. Unificar el radio de todos los botones (`.btn-primary`, `.btn-secondary`, `#new-book`, `.qc-fab`) a `--radius-md` (`12px`) y el asa de las hojas (`.sheet::before`) a `36×4px`.
  2. Unificar las casillas marcadas y barras de avance en el único acento azul cobalto (`--accent`) y los textos de vencimiento en rojo urgente (`--high`), quitando el verde `--grn-mid` de casillas/barras y el naranja `--fire` de tareas vencidas.
  3. Cambiar todas las barras de progreso (`.day-progress .bar > span`, `.rt-bar span`, `.read-bar i`) para que usen `transform: scaleX()` en vez de `width`.
  4. Ajustar el `padding-bottom` de `.app-main` en móvil y escritorio para que el botón flotante «+ Anotar» nunca tape el final de ninguna lista.
  5. Limpiar el bloque `:root` viejo duplicado en `styles.css:1-36`, actualizar `"background_color": "#0d0f14"` en `manifest.webmanifest`, y actualizar los iconos de la app (`icons/icon.svg` y PNG/ICO derivados) del violeta antiguo `#4f46e5` al azul cobalto `#0b5cab`.
- **Archivos que se tocan:** `styles.css`, `tablero.css`, `capture.css`, `home.js` (solo `style="--p:..."` en barra), `app.js` (solo `readingBarHTML` y `.rt-bar` si se incluye el atributo `--p`), `manifest.webmanifest`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `icons/apple-touch-icon.png`, `icons/icon.ico`.
- **Pruebas `e2e` que podrían romperse y hay que vigilar:**
  - `tests/routine-e2e.js` (línea 44): hoy comprueba `assert.strictEqual(await p.locator('.rt-bar span').evaluate((e) => e.style.width), '75%')`. Si cambiamos `style="width:75%"` por `style="--p:0.75"`, o bien mantenemos `style="width:${pct}%;--p:${pct/100}"` mientras en CSS forzamos `width: 100% !important; transform: scaleX(var(--p))` (truco limpio que **no rompe el test** y anima con `scaleX`), o actualizamos esa aserción en `tests/routine-e2e.js`.
  - `tests/full4.js` (líneas 15, 17, 19): verifica `getComputedStyle(document.body).backgroundColor` (`rgb(243, 244, 246)` en claro y `rgb(13, 15, 20)` en oscuro), que se mantienen intactos en `:root` de `tablero.css`.

### Bloque 2: Rutina (Hoy + Resumen semanal) y tarjeta «Tu día» en Inicio
- **Qué incluye:**
  1. Convertir los hábitos de Rutina Hoy (`.rt-item`) en filas con divisor de `1px` dentro de `.rt-list` y aplicar la **Decisión abierta 2** sobre el anillo de Inicio y Rutina.
  2. Aclarar las pastillas de racha por hábito (`"2 días seguidos"` en `--text-xs --muted` o quitarlas).
  3. Rediseñar la cuadrícula de **Resumen semanal** (`04`): celdas con buen tamaño táctil, hecho = punto lleno `--accent`, no hecho pasado = anillo vacío `--border`, futuro/sin datos = nada (sin cruces `✕` ni rojo/naranja).
  4. Simplificar los estados vacíos de Inicio, Rutina Hoy y Rutina Semana a una sola línea `--text-sm --muted` con acción de texto (nunca «0 %» ni 5 bloques vacíos seguidos).
  5. Aplicar la **Decisión abierta 1** en Pendientes y pasar los iconos `⋮`, `‹`, `›`, `↑`, `↓`, `✎` a SVG de `22px`.
- **Archivos que se tocan:** `home.js`, `app.js` (sección Rutina `2296-2413` y `taskHTML` `264-275`), `styles.css`, `tablero.css`, `index.html`. *(Requiere permiso del dueño para tocar las plantillas HTML dentro de `app.js`)*.
- **Pruebas `e2e` que podrían romperse y hay que vigilar:**
  - `tests/routine-e2e.js`:
    - Línea 22: busca `'Tu rutina está vacía'` en `#routine-body`. Si cambiamos el texto del estado vacío, debemos mantener la frase `"Tu rutina está vacía · Crear hábito"` (en una sola línea `--text-sm --muted`) para que el test pase sin tocarlo, o actualizar la línea 22 del test.
    - Línea 23 y 13: hace clic en `[data-action=rt-add]` desde el estado vacío (hay que conservar `data-action="rt-add"` en la acción de texto del estado vacío).
    - Líneas 49-56 y 62-64: buscan `.rt-week-card`, `#routine-week-pct` y `.rt-week-card .rt-dot`. Si quitamos `.rt-week-card` de la vista «Hoy», hay que actualizar esas 10 líneas en `tests/routine-e2e.js` (o dejar `.rt-week-card` como una franja compacta de una línea si no se quiere tocar el test).
    - Líneas 69-72: verifican las clases `i.c-na`, `i.c-done`, `i.c-miss`, `i.c-pending`, `i.c-future` con `e.className.slice(2)`. **Importante:** al cambiar el diseño a puntos llenos y anillos vacíos por CSS, debemos **conservar intactos los nombres de clase `c-done`, `c-miss`, `c-pending`, `c-future`, `c-na`** en los `<i>` para que `tests/routine-e2e.js` pase al 100 % sin romperse.
    - Línea 74: verifica `#routine-week-label`, `.rt-pct` y que `.rt-review` contenga `'Aún no hay comentario'`.
  - `tests/work-e2e.js` (línea 70): también verifica que `#routine-body` incluya `'Tu rutina está vacía'`. Conservar esa frase exacta en la línea única del estado vacío evita romper `work-e2e.js` y `routine-e2e.js`.
  - `tests/pendientes-e2e.js` (líneas 11, 15-27): usa `#task-input`, `#task-form button[type=submit]` y `#quick-due`. Con la Opción A de la Decisión 1 pasa sin cambios; con la Opción B habría que actualizar `pendientes-e2e.js`.

### Bloque 3: Trabajo (Oportunidades + Ingresos)
- **Qué incluye:**
  1. Quitar las 3 cajas `.wk-funnel` y mostrar la línea `#work-count` (`2 por revisar · 1 aplicada · 0 con respuesta`).
  2. Pasar los botones de ancho completo `+ Añadir oportunidad` y `+ Añadir ingreso` de `.btn-primary` a `.btn-secondary` para que no compitan con «+ Anotar».
  3. Hacer que `#work-filter` (`Activas / Todas`) sea una fila ligera de chips y que `.wk-card` e `.inc-row` sean filas con divisor de `1px` dentro de una tarjeta por lista.
  4. Ocultar el bloque gigante `$ 0` cuando no hay ingresos en el mes, subir la fecha/tipo de cada ingreso a `--text-sm`, subir `.wk-status` a `44px` de alto táctil y cambiar `✎`, `‹`, `›` por SVG de `22px`.
- **Archivos que se tocan:** `app.js` (`renderWork` y `renderIncome`, líneas `2545-2611`), `styles.css`, `tablero.css`. *(Requiere permiso del dueño para tocar las plantillas HTML de `app.js`)*.
- **Pruebas `e2e` que podrían romperse y hay que vigilar:**
  - `tests/work-e2e.js`:
    - Línea 22: comprueba `includes('Aún no hay oportunidades')` en estado vacío (conservar esa frase en la línea única: `"Aún no hay oportunidades. · Añadir oportunidad"`).
    - Línea 31 y 45: lee `#work-count`. Al quitar `clip: rect(0 0 0 0)` de `#work-count` y borrar `.wk-funnel`, `#work-count` sigue teniendo exactamente el mismo texto y el test pasa.
    - Líneas 52-54: lee `#work-filter button` (`['Activas (3)', 'Todas (4)']`) y hace clic en `#work-filter [data-all="1"]` y `[data-all="0"]`. Conservar ese HTML exacto estilizado como chips hace que el test pase sin cambios.
  - `tests/income-e2e.js`:
    - Línea 21 y 44: comprueba `'Aún no hay oportunidades'`.
    - Línea 22-23: comprueba en mes vacío `assert.strictEqual(await p.locator('#inc-total').innerText(), '$ 0')` y `includes('No hay ingresos en octubre 2026')`. **Detalle clave:** para que no se vea el `$ 0` gigante en pantalla cuando `t.count === 0` pero `tests/income-e2e.js:22` no falle si no se edita el test, podemos aplicar la clase `.inc-total.is-empty { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0) }` cuando `t.count === 0` (o actualizar la línea 22 de `income-e2e.js`).

### Bloque 4: Resúmenes + Página de libro + Ajustes + Hoja de Claude
- **Qué incluye:**
  1. Arreglar el corte de palabras en las tarjetas de Resúmenes (`overflow-wrap: break-word; hyphens: auto; -webkit-line-clamp: 3`), quitar la doble tarjeta y sombra dura en `.book-card` / `.book-open`, y alinear el chip activo `.bk-chip.active` con borde `--accent`.
  2. En la página del libro (`08`): mostrar `.dot-rail` solo con `≥ 2` títulos `h1`, aplicar `--font-serif` (`Georgia`) a los párrafos del resumen libre, centrar el input `#book-chapters` sin flechitas nativas (`44px`), y cambiar `←`, `−`, `+` por SVG de `22px`.
  3. En Ajustes (`09`): fusionar el botón `#enable-notif` dentro del interruptor `#notify-switch` con la línea de ayuda `#notify-status` en `--muted` si el permiso se bloquea, ajustar tamaños de `.sync-card` y `.settings-title` (`--text-xs`), y cambiar `✕` y `▾` por SVG.
  4. En la hoja de Claude (`10`): quitar el emoji `📞` y el verde `#16a34a` de `#claude-call` (pasándolo a botón secundario con SVG de teléfono), usar `--radius-sm` en las esquinas de `.msg`, ocultar `.claude-foot` cuando no está sincronizado y cambiar `✕` por SVG.
- **Archivos que se tocan:** `index.html`, `styles.css`, `tablero.css`, `calls.css`, `app.js` (`renderSettings` `689-700`, `#notify-switch` `757-765`, `freeViewHTML` `1869`, `readingPanelHTML` `2004-2007`). *(No se toca `calllogic.js` ni `calls.js`)*.
- **Pruebas `e2e` que podrían romperse y hay que vigilar:**
  - `tests/full5.js`:
    - Línea 34 y 47: comprueba `assert(await p.locator('#book-page .dot-rail button').count() === 2)`. Como el libro de prueba tiene 2 títulos `h1` (`Cap 1` y `Cap 2`, o `Introducción` y `Conclusión`), la condición `titles.length >= 2` mantiene los 2 puntos y el test pasa intacto.
    - Línea 30: comprueba `.book-row-author` (`'Autor A'`). Nota: `tablero.css:222` tenía `font-variant-caps: all-small-caps` (no `text-transform: uppercase`), por lo que `innerText` sigue devolviendo `'Autor A'`.
  - `tests/reading-e2e.js`: usa `#new-book`, `.book-card .book-open`, `.read-seg`, `#book-chapters`, `.chap-row [data-action=chap-inc]`, `#book-filter [data-filter=...]`. Todos los selectores se conservan.
  - `tests/sync-e2e.mjs` (línea 97): hace clic en `#notify-switch` y verifica `aria-checked`. Como en el test el contexto tiene `permissions: ['notifications']`, funciona sin cambios. En la línea 158 verifica que `#widget-block` en PC contenga `'solo para Android'`, por lo que debemos conservar ese texto en `#widget-block` en `app.js:1325` para no romper `sync-e2e.mjs`.
  - `tests/calls-e2e.mjs` (líneas 64-67 y 122): verifica `#open-claude`, `#claude-setup`, `#claude-call` y `#close-claude`. Todos los selectores y textos se mantienen intactos.

---

## Icono de la app (`icons/`)

Hoy el icono de la aplicación (`icons/icon.svg` y los PNG instalados en el celular y escritorio) sigue teniendo el fondo violeta/índigo antiguo (`#4f46e5`), que está en la lista negra de `art-direction` y choca con el nuevo azul cobalto de la interfaz.

**Qué se cambia:**
1. **`icons/icon.svg`:** Cambiar el color del fondo en la línea 2 de `fill="#4f46e5"` al azul cobalto oficial `--accent` (`fill="#0b5cab"`):
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
     <rect width="512" height="512" rx="112" fill="#0b5cab"/>
     <path d="M148 268l78 78 138-160" fill="none" stroke="#fff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
     <rect x="148" y="378" width="216" height="26" rx="13" fill="#fff" opacity=".55"/>
   </svg>
   ```
2. **Regeneración de los PNG y del ICO con Playwright/Chromium:**
   - `icons/icon-192.png` (`192×192 px`, fondo transparente fuera del radio `rx="112"`).
   - `icons/icon-512.png` (`512×512 px`, propósito `"any"` en `manifest.webmanifest`).
   - `icons/maskable-512.png` (`512×512 px`, propósito `"maskable"`: fondo sólido completo `#0b5cab` sin esquinas recortadas `rx="0"`, con el chulo y la línea escalados dentro de la **zona segura central del 80 %**, es decir, dentro de un círculo/cuadro central de `410×410 px` con margen mínimo de `51 px` por cada lado para que Android no recorte el trazo en iconos redondos o de gota).
   - `icons/apple-touch-icon.png` (`180×180 px`, fondo sólido `#0b5cab` sin transparencia para iOS).
   - `icons/icon.ico` (icono multipropósito para el acceso directo de Windows en `escritorio/Crear-acceso-directo.cmd`, generado a partir de las vistas de `16×16`, `32×32`, `48×48` y `256×256 px`).
3. **`manifest.webmanifest`:** Actualizar `"background_color"` de `"#0f172a"` a `"#0d0f14"` (el token `--bg` oscuro real de `tablero.css`), haciendo juego con `"theme_color": "#0b5cab"`.
