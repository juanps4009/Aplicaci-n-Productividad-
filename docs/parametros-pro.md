# Parámetros Profesionales de Diseño Móvil (390×844 px) — «Pendientes y Resúmenes»

> **Filtro de Claude (16 nov 2026) — manda sobre cualquier línea de abajo que lo contradiga.**
> 1. **Zonas reales del pulgar en 390×844:** `0..200px` difícil (solo lectura), `200..480px` alcance estirando (lista), `480..780px` cómoda (flotante y pestañas). Que la primera fila empiece antes de `y = 170px` sirve para leer rápido, no para tocar: por eso completar se resuelve deslizando la fila entera (`swipe.js`), no solo con la casilla.
> 2. **La meta va debajo del título**, no a la derecha (a la derecha deja 200 px al título). A la derecha solo el punto de prioridad o una cifra.
> 3. **Una sola cifra de avance por vista.** En Inicio: «2 de 8 hechos hoy» + línea de 4 px, fuera de la caja de tareas. Se eliminan «máx. 3», «Tareas 0/3 · Hábitos 2/5» y la línea de pulso de Pendientes; el riel `.seg` no lleva conteos.
> 4. **Escala cerrada:** los 13 px de abajo se leen como `--text-sm` (14 px). Filas de «Tus áreas» de 48 px, no 46.
> 5. **Vivo aún no existe en el código:** `data-estilo`, `--day-tint`, `--medium-bg`, `--ease-spring-check` y `navigator.vibrate` están especificados, no implementados.
> 6. **`···` y conteos en `.seg`:** antes de tocarlos en código, revisar `tests/` (hay e2e sobre `.more`, `.task-item` y `.group-head`).

## a. Arquitectura espacial sin cajas
- **Escala de ritmo vertical (base 4px):** `4px` (entre `.task-title` y `.meta`), `8px` (entre `.group-head` y su primera fila), `12px` (`padding-block` de `.task-item`), `16px` (`padding-inline` de `.page`), `24px` (separación entre bloques funcionales). Prohibido usar márgenes fuera de `4 / 8 / 12 / 16 / 24 / 32px`.
- **Proximidad en vez de bordes:** Un encabezado `.group-head` lleva `margin-top: 20px; margin-bottom: 6px; border-bottom: 1px solid var(--border)`. La relación `20px : 6px` (`3.3:1`) agrupa visualmente las filas sin encerrar cada grupo en una caja `.card`.
- **Contraste tipográfico (pares tamaño / peso / tracking / line-height):**
  - *Título (`#page-title`):* `24px` Sobrio / `26px` Vivo (`--text-xl`), peso `800`, `letter-spacing: -0.035em`, `line-height: 1.15`.
  - *Cifra de instrumento (`#inc-total`, `.num-hero`):* `24px`, peso `800`, `letter-spacing: -0.035em`, `tabular-nums`, `line-height: 1.1`.
  - *Cuerpo accionable (`.task-title`, `.rt-name`, `input`):* `16px` (`--text-base`), peso `500` (activo) / `400` (completado), `line-height: 1.35`.
  - *Cabecera de grupo (`.group-head`):* `13px` (`0.8125rem`), peso `700`, `letter-spacing: 0.01em` (tipo oración, no mayúsculas), `line-height: 1.2`.
  - *Metadatos y contadores (`.meta`, `.count`, fechas):* `13px–14px` (`--text-sm`), peso `500`, `color: var(--muted)`, `line-height: 1.3`.
- **Alineación óptica (una sola guía izquierda en `x = 16px`):**
  ```css
  .task-item { display: grid; grid-template-columns: 22px 1fr auto; column-gap: 12px; align-items: start; padding: 12px 0; border-top: 1px solid var(--border); }
  .task-item .chk { width: 22px; height: 22px; margin-top: 0; position: relative; }
  .task-item .chk::before { content: ""; position: absolute; inset: -13px; } /* Área táctil 48×48px */
  .task-item .meta-right { align-self: center; text-align: right; font-variant-numeric: tabular-nums; }
  ```
- **Cuándo SÍ se permite una caja y cuántas por pantalla:**
  - Solo se usa contenedor (`.card`, fondo `--surface` o `--day-tint`, borde `1px`) para aislar una unidad de foco distinta del lienzo (ej. `.home-day` en Inicio o «Leyendo ahora» en Resúmenes).
  - **Límite estricto:** **Máximo 1 caja protagonista por pantalla** (o 2 si hay resumen superior + 1 contenedor único de lista). **Prohibido:** una caja por grupo (`Vencidas`, `Hoy`, `Próximas`), una caja por fila o cajas anidadas.

## b. Superficies, luminancia y reserva quirúrgica del color
- **Capas y delta de luminancia (ΔL):** Máximo **3 capas** (`--bg`, `--surface`, `--surface-2`).
  - *Claro:* Lienzo `#f3f4f6` (L=0.91) / `#f7f5f0` (L=0.92) → Superficie `#ffffff` (L=1.00, ΔL = +8 %) o `--day-tint` `#f6f9ff` (L=0.95) → Control `#eceef1` / `#eeeae2` (L=0.84, ΔL = −8 %).
  - *Oscuro:* Lienzo `#0d0f14` / `#0b0d13` (L=0.008) → Superficie `#161922` / `#131722` (L=0.018) → Control `#202532` / `#1c2230` (L=0.032). Cero sombras negras.
- **Borde óptico de `1px`:** En claro, mismo matiz del lienzo con `-10%` de luminancia (`#e3e5e9` en Sobrio, `#dcd6ca` en Vivo + labio inferior `2px` `#c4bdb0` a `-18%`). En oscuro, `1px solid rgb(255 255 255 / 0.08)` + luz cenital `inset 0 1px 0 rgb(255 255 255 / 0.08)`.
- **Regla de reserva del color (lista cerrada y presupuesto ≤ 8 % de píxeles de la pantalla):**
  1. **Acción (`--accent` `#0052cc` / `#5ca8ff`):** **ÚNICO relleno sólido saturado** en pantalla. Exclusivo de `.qc-fab` («+ Anotar»), `.btn-primary` (1 por vista) y casilla `:checked`. **Prohibido como fondo de tarjeta o grupo.**
  2. **Vencido (`--high` `#c92a2a` / `#ff7b6b`):** Solo **texto** (`.due-label.overdue`) o micro-píldora (`background: var(--high-bg); color: var(--high); padding: 1px 6px`).
  3. **Prioridad (`--high`, `--medium`, `--low`):** Solo **punto `.dot` de `8px`** o **borde izquierdo de `3px`**, nunca fondo de fila.
  4. **Progreso (`--area-mid` / `--accent`):** Solo **trazo fino** de `4px` (`transform: scaleX()`).
  5. **Dinero (`#inc-total`):** Tinta neutra `--text`, nunca verde.
  6. **Área en Vivo (`--area-fg`):** Solo tinta de `#page-title`, punto de `8px`, icono activo de `.bottom-nav` y `.group-head`.

## c. Precisión instrumental, Ley de Fitts y micro-interacciones
- **Cifras tabulares y formato:** `.num, .count, .meta, time, #inc-total, .rt-pct { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }`. Moneda colombiana `$ 430.000` (espacio duro, punto de miles, sin centavos), avance `2/8` o `2 de 8`, fechas `13 nov` (sin punto). Cifras derechas alineadas al eje `x = 374px` (`right: 16px`).
- **Ley de Fitts en `390×844 px` (uso con una mano):**
  - *Zona difícil (`y = 0..140px`):* Solo título, filtro segmentado y ajustes. Prohibido ubicar aquí el campo de crear tarea.
  - *Zona media de escaneo y acción (`y = 140..560px`):* La primera tarea DEBE iniciar en `y ≈ 148–168px`. Filas de `min-height: 52px`; casilla con área táctil `48×48px`.
  - *Zona cómoda del pulgar (`y = 560..844px`):* Disparador `.qc-fab` («+ Anotar», `height: 48px`, `right: 16px; bottom: 76px`) y `.bottom-nav` (`height: 60px + safe-area`, 5 celdas de `78×60px`). Las listas llevan `padding-bottom: 148px` para que el FAB jamás tape filas.
- **Revelación progresiva:** En reposo, la fila muestra máximo **3 elementos**: casilla (`22px`), título (`16px`, `-webkit-line-clamp: 2`) y meta derecha (`13 nov · ●`). Se elimina el botón `···` fijo; tocar la fila abre la hoja `.sheet` de edición.
- **Micro-interacciones y háptica:** Presión `:active` con `transform: scale(0.98)` (`+ translateY(1px)` en Vivo) en `100ms`, curva `cubic-bezier(0.22, 1, 0.36, 1)`. Casilla `:checked`: en Sobrio `scale(0.9 -> 1)` (`140ms`); en Vivo `cubic-bezier(0.34, 1.35, 0.64, 1)` (`220ms`) + `if (navigator.vibrate) navigator.vibrate(8);`.

## d. Filtro Anti-AI-Slop (18 clichés erradicados y su sustituto concreto)
1. **Contenedor relleno de azul `#0052cc` («Lo importante hoy» o grupo «HOY»):** → Superficie `--surface` o tinte plano `--day-tint` (`#f6f9ff` / `#121c2d`).
2. **Píldora blanca de parche para leer «Vencida» sobre fondo azul:** → Texto `--high` (`#c92a2a`, ratio `5.46:1`) directo sobre superficie clara.
3. **Cuatro contadores en `120px` («máximo 3», «0/3», «2/5», «2/8» gigante):** → Una sola línea de `13px --muted` (`2 de 8 hechos hoy · Tareas 0/3 · Hábitos 2/5`).
4. **Anillo de progreso de `56–112px` robando altura:** → Barra horizontal fina de `4px` (`transform: scaleX()`).
5. **Icono en cuadrito pastel + mini-barra + chevron en «Tus áreas»:** → Glifo limpio de `18px` + nombre + 1 dato tabular derecho (`3 hoy · 1 vencida`).
6. **Una tarjeta con borde y sombra por cada grupo (`Vencidas`, `Hoy`, `Próximas`):** → Lista continua separada por `.group-head` y líneas de `1px`.
7. **Tres iconos mudos sin etiqueta en cabecera de Pendientes:** → Máximo 1 control con `aria-label` claro.
8. **Campo «Nueva tarea… +» arriba compitiendo con «+ Anotar» abajo:** → Eliminar campo superior; captura única con `+ Anotar` en zona del pulgar.
9. **Tres baldosas simétricas en Trabajo (`2 Por revisar`, `1 Apliqué`, `0 Me respondieron`):** → Línea tabular `2 por revisar · 1 aplicada · 0 con respuesta`.
10. **Ceros gigantes en estados vacíos (`0%`, `$ 0`, `0/3` en `26px`):** → Ocultar métrica cuando es `0`; mostrar 1 línea tranquila con acción.
11. **Botón «···» repetido en cada fila:** → Eliminar en reposo; abrir opciones al tocar la fila.
12. **Etiquetas en MAYÚSCULAS espaciadas por toda la app:** → Tipo oración peso `700` (`Lo importante hoy`, `Tus áreas`).
13. **Tarjeta dentro de tarjeta en libros (`.book-card > .book-open`):** → Portada única `.book-open` con pliegue interior `inset 6px 0 0 rgb(0 0 0 / 0.16)`.
14. **Cruces rojas/naranjas (`✕`) de castigo en rutina semanal:** → Anillo neutro vacío `2px solid var(--border)`.
15. **Palabras rotas (`conmemorativ / a` por `overflow-wrap: anywhere`):** → `overflow-wrap: break-word; hyphens: auto` y `-webkit-line-clamp: 2`.
16. **Degradados diagonales o morado-índigo (`#4f46e5`):** → Tonos planos (`#f7f5f0`, `#0052cc`, `#0b5cab`).
17. **Sombras difusas en modo oscuro (`0 4px 14px`):** → `--shadow: none` + elevación por luminancia y luz cenital `inset 0 1px 0 rgb(255 255 255 / 0.08)`.
18. **Frases de robot o marketing («¡Crea el primero!», «Las tareas vencidas aparecen aquí»):** → Español de Colombia directo en segunda persona (`tú`).

## e. Veredictos razonados y postura frente a D1–D5
- **Postura sobre D1–D5:** Confirmo **D1, D2 y D4** con pruebas matemáticas (`#c92a2a` sobre `#0052cc` da un contraste ilegal de `1.29:1` y duplica el relleno del FAB). **Discrepo parcialmente de D3 y D5:** en **D3**, «Tus áreas» sí debe existir en Inicio como *radar matutino de excepciones* (`1 vencida`, `$ 430.000`) para ahorrar viajes a ciegas por las pestañas, pero sin mini-barras ni chevrons. En **D5**, mover las casillas a la derecha rompe la fijación sacádica inicial en lectura LTR con títulos de largo variable; la solución real es área táctil de `48×48px` a la izquierda y subir la primera tarea de `y=410px` a `y=148px`.
- **Veredicto 1 — Anillo (56px) vs. Línea fina (4px) en Inicio:**
  Gana de forma definitiva la **Opción B (Línea fina horizontal de `4px` con `transform: scaleX()`)**.
  El anillo de `56px` consume `~72px` verticales, introduce un círculo que compite con las casillas de `22px` y convierte un dato pasivo (`2/8`) en el centro visual.
  La línea de `4px` al pie de «Lo importante hoy» junto a `2 de 8 hechos hoy · Tareas 0/3 · Hábitos 2/5` en `13px --muted` entrega el mismo feedback ahorrando `54px`.
- **Veredicto 2 — Campo arriba vs. Solo botón flotante «+ Anotar» en Pendientes:**
  Gana de forma definitiva la **Opción B (Solo botón flotante «+ Anotar» abajo a la derecha)**.
  El campo «Nueva tarea… +» en `y ≈ 70px` obliga a estirar el pulgar hasta el borde superior, empuja las tareas `64px` hacia abajo y duplica el botón primario.
  Un único `.qc-fab` en `right: 16px; bottom: 76px` que abre la hoja de captura con `autofocus` inmediato unifica la creación en toda la app y despeja la cabecera.
- **Veredicto 3 — Qué hacer con «Tus áreas» y con el grupo «HOY» relleno:**
  En Inicio, «Tus áreas» pierde las mini-barras, los cuadritos de icono y los chevrons: queda como **4 filas limpias de `46px`** con glifo de `18px`, nombre a la izquierda y **1 solo dato tabular a la derecha** (`3 hoy · 1 vencida`, `2/5 hoy · racha 1d`, `$ 430.000`, `Hábitos atómicos`).
  En Pendientes, el grupo **HOY jamás lleva fondo `#0052cc`**: todas las secciones (`Vencidas`, `Hoy`, `Próximas`) comparten el lienzo/superficie limpia separadas por `20px` y cabeceras `.group-head` (`Vencidas` en `--high`, `Hoy` en `--area-fg`, `Próximas` en `--muted`).

## f. Estructura vertical en `390×844 px` (versión final filtrada; mismo DOM para Sobrio y Vivo)

### 1. INICIO (todo visible sin scroll)
- **`y = 0..64` — Cabecera:** el titular es la fecha, `Domingo 15 nov` (`--text-xl`, peso 800). El saludo baja a una línea de 14 px `--muted` encima, o se quita. A la derecha, 2 iconos de 44 px (Claude, Ajustes).
- **`y = 64..100` — Pulso:** `2 de 8 hechos hoy` (14 px, peso 600, `tabular-nums`) + línea de 4 px a todo el ancho (`scaleX`). Única cifra de avance de la pantalla; si no hay nada planeado, se oculta.
- **`y = 112..~330` — Única caja, `.home-day`:** fondo `--surface` (Sobrio) o `--day-tint` (Vivo), borde 1 px (+ labio 2 px en Vivo). Encabezado `Lo importante hoy` (14 px, 700, `--area-fg` en Vivo), sin «máximo 3». Tres filas de ~60 px: casilla 22 px (toque 48), título 16 px, meta debajo (`Vencida · 13 nov` en `--high`; `Hoy` en `--muted`), punto de prioridad a la derecha. Sin pie.
- **`y = ~350..570` — «Tus áreas», sin caja, sobre el lienzo:** encabezado 14 px/700 + 4 filas de 48 px con divisor 1 px: glifo 18 px + nombre (16 px, 600) y un dato a la derecha: `3 hoy · 1 vencida` (lo vencido en `--high`), `2 de 5 · racha 1 d`, `$ 430.000`, `Hábitos atómicos`. Sin mini-barras ni chevrons.
- **`y = 720..768` — `+ Anotar`** (`right: 16px; bottom: 76px`, único relleno `--accent`) y **`y = 780..844` — barra inferior.**
- **Peor caso:** tres títulos a 2 líneas suben la caja ~66 px; «Tus áreas» termina en ~636 px, aún por encima del flotante.

### 2. PENDIENTES (primera tarea en `y ≈ 136px`; hoy está en `≈ 410px`)
- **`y = 0..56` — Cabecera:** `Pendientes` (`--text-xl`, punto de 8 px en Vivo) + máximo 2 iconos con `aria-label` (ordenar, Claude). Sincronizar solo aparece si está en curso o falló.
- **`y = 56..100` — Riel `.seg`:** `Pendientes | Todas | Hechas`, sin conteos.
- **`y = 100..` — Lista continua, sin tarjetas por grupo:** `Vencidas 1` (encabezado en `--high`), `Hoy 3` (`--area-fg`), `Próximas 3` (`--muted`); 24 px de aire antes de cada encabezado, divisores de 1 px, `padding-bottom: 148px`. Sin relleno azul en ningún grupo. Sin línea de pulso: el avance del día vive en Inicio.
- **Captura:** solo `+ Anotar` en el celular (abre la hoja con el cursor ya puesto). En computador (≥ 1024 px) se conserva el campo «Nueva tarea…» en línea y se oculta el flotante.
- **Gestos:** fila a la derecha = hecha; a la izquierda = mañana; tocar = editar. Siempre con «Deshacer».
