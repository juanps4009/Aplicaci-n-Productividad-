---
name: art-direction
description: Dirección de arte obligatoria de «Pendientes y Resúmenes» (móvil Android 390×844, escritorio y widget). Invócala SIEMPRE antes de crear, editar o auditar HTML, CSS, componentes, colores, tipografía, espaciado, animaciones, estados vacíos, modo oscuro o aspectos Sobrio/Vivo, y cuando el dueño diga «se ve de IA», «se ve feo», «está cargado», «ponlo más bonito» o «hazlo más vivo».
---

# Dirección de Arte — «Pendientes y Resúmenes» (Sobrio & Vivo)

Herramienta personal de uso diario con **una sola mano en celular Android (390×844 px)**, computador (1440×900 px) y widget de escritorio (`340×480 px`). HTML/CSS/JS puros sin librerías ni empaquetadores. Comparte **exactamente el mismo DOM** entre dos aspectos conmutables en `<html data-estilo="sobrio|vivo">` (`tablero.css` se carga después de `styles.css` y manda). Referencias de oficio: Things 3, Linear, Copilot Money, Amie y Flighty. **Idea rectora:** la lista accionable del día es la protagonista en el primer pantallazo; todo lo demás se aparta.

## 0. Check rápido de pre-ejecución (obligatorio antes de escribir CSS o HTML)

Responde **Sí / No** en 4–6 líneas en tu respuesta antes de tocar código; si alguna es «No», corrige el diseño antes de implementar:
1. **¿Puedes decir en una frase la única petición de la pantalla, y es la única pieza con `--accent` sólido?** (Prohibido que dos botones o un contenedor compitan en azul saturado).
2. **¿La primera fila accionable empieza antes de `y = 170px` en `390×844 px`?** (Es para leer en menos de 2 s, no para el pulgar. Prohibido gastar media pantalla en cabeceras, formularios fijos o contadores).
3. **¿Hay máximo 1 caja contenedora protagonista (`.card`) en la vista?** (Los grupos se separan con espacio y líneas de `1px`, nunca una tarjeta por grupo).
4. **¿Hay una sola cifra de avance en toda la vista, en `--text-sm` con línea de `4px`, y fuera de la caja de tareas?** (Nada de anillos ni cifras de titular para datos pasivos).
5. **¿Están diseñados los 6 estados de la vista?** (Vacío sin ceros gigantes, cargando/trabajando, 1 ítem, muchos ítems, texto de 3 líneas sin cortar sílabas y error).
6. **¿El mismo HTML funciona en las 4 combinaciones (`sobrio/vivo` × `light/dark`) usando exclusivamente tokens de `tablero.css`?**
7. **¿Verificaste que ningún elemento flotante (`.qc-fab`) tape la última fila interactiva (`padding-bottom: 148px`)?**

## 1. Lista negra Anti-AI-Slop (prohibiciones absolutas)

- **PROHIBIDO usar `--accent` (`#0052cc` / `#0b5cab`) como fondo de contenedor, tarjeta o grupo** (ej. prohibido pintar «Lo importante hoy» o el grupo «HOY» de azul saturado). El relleno `--accent` es **exclusivo** del botón primario (`.qc-fab`, `.btn-primary`) y de la casilla marcada `:checked`.
- **PROHIBIDO meter parches de contraste** (como píldoras blancas para poder leer «Vencida» sobre un fondo azul saturado). Si un color semántico (`--high`) no pasa WCAG AA (`4.5:1`) directo sobre la superficie, la superficie está mal elegida.
- **PROHIBIDO duplicar contadores** (ej. «máximo 3» + «0/3» + «2/5» + «2/8 hechos hoy» en `120px`, o «7 pendientes de 8» + «Hoy: 0 de 3» + conteo por grupo). Máximo **1 cifra de avance** por vista; los conteos por grupo van en su encabezado y ya suman el total.
- **PROHIBIDO que el texto más grande de la pantalla no informe nada** (saludo «Buenas tardes» en `32px`) y **explicar reglas en la interfaz** («máximo 3»). El titular lleva dato útil (fecha, nombre de la vista); las reglas se dicen solo en el estado vacío.
- **PROHIBIDO encerrar cada grupo (`Vencidas`, `Hoy`, `Próximas`) o cada fila en su propia tarjeta con borde/sombra.** La estructura nace de la proximidad (`20px` arriba, `6px` abajo) y divisores de `1px`.
- **PROHIBIDO el «kit SaaS de IA»:** las 3 baldosas simétricas con números de colores (`.wk-funnel`), los iconos encerrados en cuadritos pastel (`.area-ico` con fondo), y las tarjetas dentro de tarjetas (`.book-card > .book-open`).
- **PROHIBIDO duplicar el control de captura:** nunca pongas un campo «Nueva tarea… +» arriba ni un segundo botón primario azul si ya existe el flotante `+ Anotar` (`.qc-fab`).
- **PROHIBIDO gritar ceros o ausencias en tamaño titular:** nada de `0%`, `$ 0` o `0/3` en `24–32px`, ni cruces rojas/naranjas (`✕`) de castigo en hábitos pasados.
- **PROHIBIDO el índigo/violeta (`#4f46e5`, `#6366f1`), los degradados (`linear-gradient`) y las sombras difusas en modo oscuro.**
- **PROHIBIDO repetir elementos mudos:** máximo 2 iconos en cabecera (cada uno con `aria-label`; el estado de sincronización solo aparece si está en curso o falló), sin botones `···` en cada fila ni mini-barras ni chevrons en las filas de «Tus áreas».
- **PROHIBIDO animar propiedades de layout (`width`, `height`, `top`, `bottom`, `margin`, `padding`), usar `backdrop-filter: blur()` o curvas con rebote (`> 1` fuera de casillas Vivo).**
- **PROHIBIDO el microcopy robótico o de anuncio:** nada de «¡Crea el primero!», explicaciones del algoritmo («Las tareas vencidas aparecen aquí»), signos de exclamación ni emojis decorativos. Español de Colombia directo en segunda persona (`tú`).

## 2. Parámetros profesionales obligatorios (390×844 px)

### 2.1 Tipografía, escala e instrumentos (`tabular-nums`)
- **Familias locales únicas:** `--font-sans` (`"Manrope", system-ui, sans-serif`, `fonts/manrope.woff2` pesos `200–800`); `--font-serif` (`Georgia, serif`, `18px`, `line-height: 1.65`, `max-width: 65ch`) solo para leer resúmenes; `--font-mono` (`ui-monospace`) solo para el código de sincronización.
- **Escala cerrada de 5 peldaños (prohibido inventar tamaños fuera de escala):**
  - `--text-xs` (`12px` / `0.75rem`, peso `600`, `line-height: 1.25`): etiquetas de `.bottom-nav`, insignias y máximo 1 subtítulo técnico por hoja.
  - `--text-sm` (`14px` / `0.875rem`, peso `500`, `line-height: 1.35`, `--muted`): metadatos (`13 nov · Alta`), cifra de avance, estados vacíos y encabezados de grupo (estos en peso `700`).
  - `--text-base` (`16px` / `1rem`, peso `500` en texto, `600` en botones, `line-height: 1.35`): títulos de tareas/hábitos y **todo `<input>`, `<select>` o `<textarea>`** (nunca `< 16px` para evitar zoom en móvil).
  - `--text-lg` (`18px` / `1.125rem`, peso `700`, `line-height: 1.25`): títulos de hojas modales (`.sheet`), libros y secciones de lectura.
  - `--text-xl` (`24px` en Sobrio / `26px` en Vivo, peso `800`, `letter-spacing: -0.035em`, `line-height: 1.15`): `#page-title` y cifra principal de Ingresos (`#inc-total`).
- **Precisión numérica obligatoria:** Toda cifra, fecha, fracción, racha o monto lleva `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`. Formato colombiano estricto: `$ 430.000` (espacio tras `$`, punto de miles, sin centavos), fechas `13 nov` (sin punto), avance `2 de 8`.
- **Corte limpio de textos largos:** Prohibido `overflow-wrap: anywhere` (rompe `conmemorativ / a`). Usar `overflow-wrap: break-word; hyphens: auto` (`lang="es"`) y `-webkit-line-clamp: 2` en filas (`3` en portadas de libros).

### 2.2 Jerarquía espacial sin cajas y alineación óptica
- **Ritmo en múltiplos de `4px`:** `4px` (título a meta), `8px` (cabecera de grupo a primera fila), `12px` (padding vertical de fila), `16px` (margen lateral de pantalla), `20–24px` (separación entre grupos).
- **Dos guías y nada más:** casillas y encabezados `.group-head` en `x = 16px`; títulos y su meta en `x = 50px` (`16 + 22 + 12`); cifras y puntos a la derecha en `x = 374px`. Ningún elemento empieza en otra coordenada.
- **La meta va DEBAJO del título, no a la derecha:** una meta derecha de `~110px` deja `200px` al título y lo parte en 3 líneas. A la derecha solo cabe el punto de prioridad (filas de tarea) o una cifra (filas de dato: áreas, ingresos).
- **Contrato CSS de fila accionable y encabezados de grupo (`.task-item`, `.home-task`, `.rt-item`, `.group-head`):**
  ```css
  .group-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin: 24px 0 0; padding-bottom: 8px;
    font-size: var(--text-sm); font-weight: 700; color: var(--area-fg, var(--text));
    border-bottom: 1px solid var(--border);
  }
  .group-head.overdue { color: var(--high); }
  .task-item, .home-task, .rt-item {
    display: grid; grid-template-columns: 22px 1fr auto; column-gap: 12px;
    align-items: start; min-height: 52px; padding: 12px 0;
    border-top: 1px solid var(--border);
  }
  .group-head + .task-item, .task-item:first-child { border-top: 0; } /* sin doble línea */
  .task-item .chk {
    width: 22px; height: 22px; position: relative;
    border: 2px solid var(--faint); border-radius: var(--radius-pill);
  }
  .task-item .chk::before { content: ""; position: absolute; inset: -13px; } /* toque 48×48 */
  .task-item .meta { margin-top: 4px; font-size: var(--text-sm); color: var(--muted); font-variant-numeric: tabular-nums; }
  .task-item .meta .overdue { color: var(--high); font-weight: 600; } /* «Vencida · 13 nov» */
  .task-item .dot { width: 8px; height: 8px; margin-top: 7px; border-radius: var(--radius-pill); }
  ```

### 2.3 Superficies, luminancia y borde óptico de `1px`
- **Máximo 3 capas de luminancia simultáneas:** Lienzo (`--bg`), Superficie (`--surface` o tinte plano `--day-tint` en `.home-day` Vivo) y Control (`--surface-2`).
- **En modo claro:** Bordes de `1px solid var(--border)` del mismo matiz del lienzo (`-10%` luminancia). En Vivo, la tarjeta protagonista y los botones añaden labio físico inferior de `2px` (`--border-strong`) que se comprime `1px` en `:active`.
- **En modo oscuro:** Cero sombras negras (`--shadow: none`). La elevación se da por 3 escalones de luminancia (`--bg < --surface < --surface-2`) + borde `rgb(255 255 255 / 0.08)` + luz cenital `inset 0 1px 0 rgb(255 255 255 / 0.08)` en Vivo.
- **Cabeceras y barra inferior:** Fondo sólido (`--bg` o `--surface`) con borde de `1px`, sin `backdrop-filter: blur()`.

### 2.4 Color semántico quirúrgico
- **Prueba del gris:** la pantalla en escala de grises debe conservar la jerarquía; si se pierde, dependía del color. **Prueba de la mancha:** entrecerrando los ojos solo se ve una mancha saturada, `+ Anotar`.
- **Lista cerrada de usos de color (lo que no esté aquí va en neutros):**
  1. **Acción (`--accent`):** Único relleno saturado en pantalla (`.qc-fab` «+ Anotar», `.btn-primary`, casilla `:checked`). Los botones secundarios de vista (`+ Añadir ingreso`, `+ Añadir oportunidad`, `+ Nuevo resumen`) usan `.btn-secondary` (`--surface-2`, texto `--text`).
  2. **Vencido / Peligro (`--high` / `--danger`):** Solo en el texto `Vencida · 13 nov` o micro-etiqueta sobre `--high-bg`, y en la cabecera `.group-head.overdue`. Jamás rellena toda la fila ni el contenedor del grupo.
  3. **Prioridad (`--high`, `--medium`, `--low`):** Solo punto `.dot` de `8px` o borde izquierdo de `3px`. Nada depende solo del color (vencida lleva la palabra «Vencida»).
  4. **Progreso:** Solo trazo horizontal fino de `4px` (`transform: scaleX(var(--p, 0)); transform-origin: left`) sobre `--track`.
  5. **Dinero:** tinta `--text`, nunca verde por adorno. Color solo si la cifra es un estado (negativo o meta incumplida en `--high`).
  6. **Identidad de área en Vivo (`--area-fg`, `--area-mid`, `--area-bg`):** Mapeada por `body[data-tab]` (`--ind` azul en Inicio/Pendientes, `--grn` esmeralda en Rutina, `--amb` ámbar en Trabajo, `--ros` ciruela en Resúmenes). Tiñe únicamente `#page-title` (con punto de `8px`), `.group-head`, el icono activo de `.bottom-nav` y glifos `.area-ico` de `18–22px` **sin cuadrito de fondo**.

### 2.5 Ergonomía táctil (Ley de Fitts en una mano) y revelación progresiva
- **Zonificación en `390×844 px`:**
  - `y = 0..200px` (difícil, solo lectura): `#page-title`, cifra de avance, riel `.seg` (`Pendientes | Todas | Hechas`, sin conteos) y como mucho 2 iconos. Nunca la acción primaria ni un campo de captura.
  - `y = 200..480px` (alcance estirando): la lista. No es zona cómoda: por eso completar NO depende de la casilla. Toda la fila se desliza a la derecha para marcar hecha y a la izquierda para pasar a mañana (`swipe.js`, hoy solo en Pendientes; extenderlo a `.home-task` y `.rt-item`).
  - `y = 480..780px` (cómoda): botón flotante `.qc-fab` (`height: 48px`, `right: 16px; bottom: 76px`) y `.bottom-nav` (`5` destinos, `env(safe-area-inset-bottom)`). Todo contenedor con scroll lleva `padding-bottom: 148px`.
  - En computador (`≥ 1024px`) no hay pulgar: ahí el campo «Nueva tarea…» en línea sí se permite y el flotante se oculta.
- **Revelación progresiva:** En reposo, cada fila muestra solo **casilla + título + meta debajo + punto**. Sin botón `···` por fila: tocar la fila abre su hoja `.sheet` de edición (antes de quitar `.more` del código, revisa `tests/`: hay e2e que lo usan). En «Tus áreas» de Inicio, cada fila (`48px`) muestra solo glifo (`18px`) + nombre + **1 dato tabular a la derecha**.
- **Controles honestos y estados vacíos:**
  - Al tocar guardar, sincronizar o conectar, el botón pasa a `disabled` y cambia su texto (`Guardando…`, `Sincronizando…`, `Conectando…`).
  - Selector `<input type="date">` siempre `min-width: 120px` (`7.5rem`).
  - Estado vacío: 1 línea tranquila en `--text-sm --muted` + enlace de acción en `--accent` (`Nada pendiente para hoy. · Anotar algo`); en Vivo añade emblema monocromo con `mask-image` sobre `--area-bg`.
- **Adaptación a computador (`≥ 1024px`) y Widget (`340×480px`):**
  - En computador: barra lateral izquierda de `232px` y contenido principal de `max-width: 640px` (o grilla de 12 columnas en Inicio donde `.home-week` vive en `grid-column: 8 / -1`).
  - En widget de escritorio (`#widget`): hereda `data-estilo` y `data-theme` desde `applyTheme()`, mantiene filas de `44px` y oculta la navegación global para no desbordar `340×480px`.

### 2.6 Movimiento en GPU y háptica
- **Solo `transform` y `opacity`:** Curvas `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` y `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)`. Duraciones: `--dur-fast` `140ms` (toque), `--dur-base` `220ms` (estado/casilla), `--dur-slow` `280ms` entrada / `200ms` salida en hojas `.sheet`.
- **Toque y completado:** Botones y filas responden en `:active` con `transform: scale(0.98)` (`+ translateY(1px)` en Vivo). Al marcar casilla: Sobrio hace `scale(0.9 -> 1)` en `140ms` sin sobrepaso; Vivo usa `--ease-spring-check: cubic-bezier(0.34, 1.35, 0.64, 1)` en `220ms` (único micro-sobrepaso del `6%`) + `navigator.vibrate?.(8)`.
- **Higiene de puntero y accesibilidad:** `:hover` siempre dentro de `@media (hover: hover) and (pointer: fine)`. `:focus-visible` con `outline: 2px solid var(--accent); outline-offset: 2px`. `@media (prefers-reduced-motion: reduce)` apaga toda animación y transición a `0.01ms`.

## 3. Referencia de Tokens (`tablero.css` y `docs/direccion-vivo.md`)

Usa siempre variables semánticas de `:root` en `tablero.css` (prohibido escribir colores o medidas sueltas). **Ojo:** el aspecto Vivo aún no está en el código (16 nov 2026). `data-estilo`, `--day-tint`, `--medium-bg`, `--low-bg`, `--area-*`, `--border-strong`, `--card-highlight` y `--ease-spring-check` están especificados en `docs/direccion-vivo.md` §4 y hay que crearlos antes de usarlos; no los des por existentes. Las medidas y estructuras por pantalla están en `docs/parametros-pro.md`. Esta skill también rige los encargos para Claude Design: pega §0 y §1 como restricciones del encargo.
- **Superficies y bordes:** `--bg`, `--surface`, `--surface-2`, `--day-tint` (exclusivo de `.home-day` en Vivo: `#f6f9ff` claro / `#121c2d` oscuro), `--track`, `--border`, `--border-strong`, `--card-highlight`, `--shadow`, `--shadow-float`.
- **Tinta (WCAG AA ≥ 4.5:1):** `--text`, `--muted`; `--faint` solo en bordes de casilla vacía, divisores e iconos guía (≥ 3:1), **nunca en texto que haya que leer**.
- **Acción y semántica:** `--accent`, `--accent-press`, `--on-accent`, `--high`, `--high-bg`, `--medium`, `--medium-bg`, `--low`, `--low-bg`, `--danger`, `--on-danger`, `--fire`, `--fire-bg`.
- **Áreas y geometría:** `--area-fg`, `--area-mid`, `--area-bg` (alimentados por `--ind*`, `--grn*`, `--amb*`, `--ros*`), `--radius-sm` (`8px`), `--radius-md` (`12px` Sobrio / `14px` Vivo), `--radius-lg` (`16px` / `18px`), `--radius-pill` (`9999px`). Los hexadecimales exactos y la tabla de contraste WCAG 2.1 están en `docs/direccion-vivo.md` §4.

## 4. Revisión final obligatoria (antes de commit)

Toma capturas reales con Playwright a `390×844 px` en las **4 variantes** (`sobrio/vivo` × `light/dark`), míralas y verifica:
- [ ] **Acento único:** ¿`+ Anotar` (o `.btn-primary`) es la única pieza con relleno `--accent` sólido en la pantalla, sin contenedores azules?
- [ ] **Foco inmediato:** ¿Las 3 tareas de Inicio se ven sin scroll y en Pendientes la primera tarea empieza antes de `y = 170px`?
- [ ] **Jerarquía limpia:** ¿`Vencidas` precede y pesa más que `Hoy` sin parches blancos, hay 1 sola cifra de avance por vista y la pantalla aguanta la prueba del gris?
- [ ] **Ergonomía y corte:** ¿Todos los botones miden `≥ 44×44px`, los campos `≥ 16px` y ningún título se parte a mitad de sílaba?
- [ ] **Cifras y pruebas:** ¿Todas las cifras tienen `tabular-nums`, cero textos robóticos, cero solapamiento del FAB y pasan `npm run unit` y `npm run e2e`?
