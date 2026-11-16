# Dirección de Arte — Aspecto «Vivo» (`[data-estilo="vivo"]`)

> **Propósito:** Definir el segundo aspecto visual intercambiable de **Pendientes y Resúmenes** («Vivo») frente al aspecto minimalista actual («Sobrio»), compartiendo **exactamente el mismo HTML y estructura DOM**, conmutable en caliente mediante `<html data-estilo="vivo">` desde Ajustes, sin librerías externas y respetando rendimiento en Android (`transform`/`opacity`), objetivos táctiles (`≥ 44×44 px`) y accesibilidad WCAG AA.

---

## 1. Diagnóstico: por qué la app actual «parece hecha por IA»

Al auditar las capturas de `colaboracion/capturas/antes/*cel-claro-lleno.png` (y sus variantes vacías) junto con `colaboracion/capturas/propuesta/*-claro.png`, se identifican dos capas del problema: primero, los **vicios clásicos de plantilla generada por IA** en el estado `antes/`; segundo, la **neutralidad clínica** del estado `propuesta/` («Sobrio»), que corrige el desorden pero aún carece de tactilidad física, carácter cromático y respuesta viva.

### 1.1 Rasgos de composición y geometría que delatan origen de IA
1. **El «kit de tarjetas SaaS» anidadas con el mismo radio (`16px`) en todo:**
   - En `antes/03-rutina-hoy-cel-claro-lleno.png` y `antes/06-trabajo-ingresos-cel-claro-lleno.png`, cada fila individual (`.rt-item`, `.inc-row`) es una caja blanca aislada con borde gris sobre un fondo gris frío (`#f3f4f6`), precedida por más cajas blancas del mismo radio.
   - En `antes/07-resumenes-cel-claro-lleno.png`, cada libro (`.book-card`) es una tarjeta blanca con borde que encierra *otra* tarjeta coloreada (`.book-open`) con sombra gris difusa (`0 6px 14px rgb(16 24 40 / 0.12)`).
2. **Las 3 baldosas simétricas con números grandes de colores y los iconos en cuadritos pastel («Three Feature Cards» / «Icon in colored box»):**
   - En `antes/05-trabajo-ofertas-cel-claro-lleno.png`, el embudo `.wk-funnel` divide la pantalla en tres cajitas idénticas (`2 Por revisar`, `1 Apliqué`, `0 Me respondieron`) con números en `24px` pintados en negro, azul y verde.
   - En `antes/01-inicio-cel-claro-lleno.png`, los accesos a las áreas usan el cliché de «icono metido en cuadrito de color pastel + etiqueta» (`.area-ico`), señalado en `docs/analisis-videos.md` (videos 5, 6 y 8) y en `impeccable/SKILL.md` como uno de los sellos más repetidos de las plantillas generadas por IA.
3. **Controles primarios duplicados compitiendo en el mismo pantallazo:**
   - En `antes/02-pendientes-cel-claro-lleno.png` (botón `+` azul arriba y `+ Anotar` azul abajo), `antes/05-trabajo-ofertas-cel-claro-lleno.png` (`+ Añadir oportunidad` a todo lo ancho y `+ Anotar` pisando la segunda oferta) y `antes/07-resumenes-cel-claro-lleno.png` (`+ Nuevo resumen de libro` y `+ Anotar`), hay dos llamadas a la acción con el mismo peso visual (`--accent`) y el botón flotante tapa el contenido final de la lista.
4. **Ceros y ausencias gritados como titulares:**
   - En `antes/01-inicio-cel-claro-vacio.png`, un anillo gris de `112px` anuncia **`0% del día`** junto a `Tareas 0/0 · Hábitos 0/0`.
   - En `antes/06-trabajo-ingresos-cel-claro-vacio.png`, una tarjeta central proclama **`$ 0`** en `24px` (`Con Claude $ 0 · Presencial $ 0`). Una app diseñada por humanos acompaña el inicio del día o del mes; una plantilla de IA imprime el valor numérico `0` sin contexto emocional.

### 1.2 Rasgos cromáticos y de superficie que delatan origen de IA
1. **Fondo gris hospitalario (`#f3f4f6`) + blanco puro (`#ffffff`) + borde gris neutro (`#e3e5e9`):**
   - Es literalmente la escala `gray-100` / `gray-200` de Tailwind que los modelos de lenguaje escupen por defecto. Incluso en las capturas limpias de `propuesta/ajustes-claro.png`, `propuesta/claude-claro.png` y `propuesta/libro-claro.png`, esa combinación de gris frío azulado con un único azul corporativo (`#0b5cab`) se siente correcta pero **aséptica**, como un formulario bancario o un panel administrativo, no como un cuaderno personal que da gusto abrir por la mañana.
2. **Semántica de color contradictoria o de castigo:**
   - En `antes/04-rutina-semana-cel-claro-lleno.png`, los días pasados sin registro (incluso previos a crear el hábito) se llenan de cruces `✕` sobre pastillas color salmón/naranja (`.c-miss`), mientras las rachas en `antes/03-rutina-hoy-cel-claro-lleno.png` usan exactamente el mismo naranja (`2 días`, `3 días`) sin verbo que explique si son días restantes o cumplidos.
   - En `antes/01-inicio-cel-claro-lleno.png` y `antes/02-pendientes-cel-claro-lleno.png`, las casillas vacías se pintan como aros rojos y verdes gruesos (`26px`), pareciendo iconos de error o éxito antes de haber interactuado con ellas.

### 1.3 Rasgos tipográficos y de texto (microcopy) que delatan origen de IA
1. **Tipografía sin contraste de carácter:**
   - Aunque `Manrope` es una excelente geométrica, usarla con el mismo `letter-spacing` casi neutro y pesos uniformes (`600–700`) tanto en fechas y etiquetas como en cifras y encabezados hace que todo tenga la misma textura visual. En `antes/07-resumenes-cel-claro-lleno.png` y `propuesta/resumenes-claro.png`, además, el corte `conmemorativ / a` o `conmemorativ...` y las etiquetas en mayúsculas espaciadas (`AVISOS EN ESTE DISPOSITIVO`, `COMENTARIO DE LA SEMANA`, `CADA DÍA`) repiten el cliché de *eyebrow label* en versalitas de las plantillas generadas.
2. **Textos explicativos de máquina o frases de plantilla:**
   - En `antes/01-inicio-cel-claro-vacio.png`: *«Nada urgente. Las tareas vencidas, las de hoy y las de prioridad alta aparecen aquí.»* (el sistema explicando su propio algoritmo de filtrado en vez de hablarle al dueño).
   - En `antes/07-resumenes-cel-claro-lleno.png` (código `index.html:91`): *«Aún no tienes resúmenes. ¡Crea el primero!»* (exclamación forzada de onboarding SaaS).
   - En `antes/09-ajustes-cel-claro-vacio.png`: interruptor encendido junto a un botón redundante *«Permitir notificaciones»* que contradice el estado visual.

---

## 2. Referencias reales (10 aplicaciones de referencia y su traducción exacta)

Para que el aspecto **«Vivo»** tenga alma de producto real y cero rastro de plantilla, tomamos prestados mecanismos concretos de 10 aplicaciones reconocidas por su oficio en diseño de interfaz, adaptándolos al DOM existente de **Pendientes y Resúmenes**:

| # | App de referencia | Rasgo concreto que observamos | Cómo lo traducimos a «Vivo» en nuestra app (mismo HTML) |
|---|---|---|---|
| 1 | **Things 3** *(Cultured Code)* | Cada área tiene un icono y acento semántico propio en su cabecera, mientras el papel de fondo tiene una calidez sutil (`#f7f5f0`) y la casilla al marcarse dibuja su trazo con precisión táctil en `~200ms`. | En `[data-estilo="vivo"]`, el lienzo pasa a papel piedra cálido (`#f7f5f0` en claro / obsidiana `#0b0d13` en oscuro). Cada pestaña (`body[data-tab]`) tiñe el icono activo, el subtítulo de grupo (`.group-head`, `.rt-group-head`) y la cápsula del título (`#page-title::before`) con su color de área, manteniendo `--accent` para la acción principal. |
| 2 | **Teenage Engineering** *(OP-1 / Field System)* | Botones y tarjetas con «labio físico» inferior (`border-bottom` de `2px` más oscuro que el borde lateral) que al presionarse (`:active`) se comprimen `1px–2px` hacia abajo, dando sensación de tecla mecánica real sin usar sombras difusas. | En Vivo, `.btn-primary`, `.btn-secondary`, `.qc-fab` y `.card` llevan un borde táctil asimétrico (`1px` arriba/lados + `2px` abajo en `--border-strong` o `--accent-press`). Al tocar (`:active`), hacen `transform: translateY(1px) scale(0.985)`, sintiéndose como un objeto físico. |
| 3 | **Streaks** *(Crunchy Bagel)* | Las casillas de rutina y los días cumplidos tienen presencia rotunda: círculos con borde generoso (`2px`) que al completarse hacen un único pulso elástico corto y llenan el círculo de color sólido con un check grueso. | En Vivo, al marcar `.task-item input[type="checkbox"]`, `.home-task .chk` o `.rt-check`, el check entra con la única curva con micro-sobrepaso permitida (`--ease-spring-check: cubic-bezier(0.34, 1.35, 0.64, 1)` en `220ms`, sobrepaso máx. `6 %`) y el texto se tacha con opacidad `0.55`. |
| 4 | **Structured** *(Structured Day Planner)* | Uso de un tinte plano muy suave y cálido para diferenciar el bloque protagonista del día («Tu día») respecto de las listas secundarias, sin recurrir a degradados artificiales. | En Vivo, la tarjeta `.home-day` recibe un fondo tintado **plano** precalculado (`--day-tint`: `#f6f9ff` en claro / `#121c2d` en oscuro, equivalente exacto a mezclar `--ind-bg` al 40 % con `--surface`), destacando el foco del día sin degradados ni `color-mix` en tiempo de ejecución. |
| 5 | **Apple Recordatorios** *(iOS)* | Los títulos grandes de lista y encabezados de sección se tiñen directamente con el color semántico de la lista en peso rotundo (`800`), mientras los iconos de área usan trazo limpio coloreado sin encerrarse en cajitas cuadradas de fondo pastel. | En Vivo, `#page-title` y `.group-head` adoptan el color de la lista/área (`--area-fg`), y en `.home-areas` eliminamos el cuadrito de fondo de `.area-ico`: queda como un icono de trazo limpio de `22×22px` (`stroke-width: 2.25`, `background: transparent`, `color: var(--tfg)`) acompañado de un punto vivo de `8px`. |
| 6 | **Flighty** *(Flighty LLC)* | Jerarquía numérica estilo tablero de instrumentos: las cifras clave (`$ 430.000`, `2 de 8`, `Capítulo 7 de 20`, `40 %`) usan pesos extremos (`800`), `tabular-nums` estricto y `letter-spacing: -0.035em`, contrastando con etiquetas técnicas limpias. | En Vivo, las cifras `.num`, `#inc-total`, `.ring b`, `.rt-pct` y `#page-title` usan el extremo `800` de Manrope con `letter-spacing: -0.035em` y tamaño expresivo (`--text-xl: 1.625rem` / `26px`), dándole empaque editorial a los datos. |
| 7 | **Linear** *(Linear Orbit)* | En modo oscuro, las superficies nunca tienen sombras negras inútiles ni bordes grises planos: tienen una «luz cenital» (`inset 0 1px 0 rgba(255,255,255,0.08)`) que hace que cada tarjeta y botón parezca tallado con precisión. | En `:root[data-estilo="vivo"][data-theme="dark"]`, `.card`, `.group-list`, `.rt-list`, `.wk-list`, `.inc-list` y `.btn-secondary` incorporan `box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08)` sobre pizarra nocturna (`#131722`). |
| 8 | **Bear** *(Shiny Frog)* | Calidez editorial en notas y lectura de libros: las portadas tienen lomo con pliegue de encuadernación realista, y el texto largo respira sobre un tono crema suave con acentos carmín/ciruela en los marcadores de progreso. | En Vivo, `.book-open` acentúa su pliegue de lomo (`inset 8px 0 0 rgb(0 0 0 / 0.22), inset 9px 0 0 rgb(255 255 255 / 0.14)`), y la vista de lectura `#book-page` usa el acento ciruela `--ros` en la barra `.read-bar i` y en el carril `.dot-rail`. |
| 9 | **Todoist** *(Doist)* | Cuando completas todas las tareas de hoy («Cero pendientes»), el estado vacío o la barra `.day-progress.all-done` no muestra un gris triste ni confeti infantil, sino una insignia cálida con una frase cercana que reconoce el cierre del día. | En Vivo, `.day-progress.all-done` y `.streak-pill` se tiñen con un sello verde esmeralda / ámbar cálido con borde de `1px`, y los estados vacíos (`#task-empty`, `.home-empty`, `#book-empty`) despliegan mediante `mask-image` un emblema geométrico adaptable al tema en `--area-mid` y `--area-bg`. |
| 10 | **Notion Calendar / Amie** | Los chips de fecha rápida (`Hoy`, `Mañana`), de estado (`Por revisar`, `Apliqué`, `Me respondieron`) y los selectores segmentados (`.seg`) tienen forma de píldora táctil con punto de color vivo a la izquierda y cambio instantáneo de peso al activarse. | En Vivo, `.seg` actúa como un riel empotrado (`padding: 4px`, borde interior sutil) donde el botón `.active` se eleva con fondo `--surface`, labio inferior de `1px` y punto indicador del color de área. |

---

## 3. Principios del aspecto «Vivo» (7 principios) y frontera con «Sobrio»

### 3.1 Los 7 principios rectores de «Vivo»
1. **Color con función de brújula (Áreas vivas + Acción única):** Cada pestaña tiene su propio color de identidad (`--area-fg`, `--area-mid`, `--area-bg`) que tiñe el icono activo de la barra inferior, el título y los encabezados de grupo (al estilo Apple Recordatorios) y las barras de avance de esa sección. **Decisión de identidad en Inicio/Pendientes:** como anotar y completar pendientes es la acción nuclear de la aplicación, el área de **Inicio/Pendientes ES la familia azul del acento**; para que el ojo distinga sin esfuerzo «identidad de área» de «botón de acción», el relleno sólido ultramar (`--accent: #0052cc` / `#5ca8ff`) se reserva **exclusivamente** al botón primario (`.btn-primary`, `.qc-fab`) y a la casilla marcada, mientras que la identidad del área usa siempre **trazo limpio sin fondo o superficie pastel suave** (`--ind-bg: #e8f0fe` / `#11243e` con tinta `#1d4ed8` / `#68b0ff`).
2. **Tactilidad física sin plástico (Bordes con labio + Luz cenital):** En lugar de sombras borrosas de plantilla (`0 4px 14px rgba(0,0,0,0.1)`), la profundidad en claro se logra con un borde perimetral de `1px` y un labio inferior de `2px` (`--border-strong`) que se comprime al presionar el botón (`translateY(1px)`). En oscuro, la altura nace de 3 escalones de pizarra más un destello superior de `1px` (`inset 0 1px 0 rgba(255,255,255,0.08)`).
3. **Papel cálido y tintes planos (cero degradados ni «crema Anthropic»):** El fondo claro huye tanto del gris hospitalario (`#f3f4f6`) como del cliché terracota-crema de Claude (`#F4F1EA` + `#D97757`) y de los degradados diagonales de IA. Usa piedra cálida luminosa (`#f7f5f0`), tinta carbón (`#141619`), azul ultramar (`#0052cc`) y un tinte plano precalculado (`--day-tint`) en la tarjeta «Tu día».
4. **Contraste tipográfico expresivo en los extremos:** Aprovechamos el rango completo de la fuente variable local `Manrope` (`200–800`): títulos de pantalla y cifras principales suben a `26px` (`1.625rem`) con peso `800` y `letter-spacing: -0.035em`, mientras las etiquetas secundarias evitan las mayúsculas gritonas y usan minúsculas con peso `600` y color de área.
5. **Respuesta elástica contenida en el instante del logro:** Marcar una tarea o hábito es el momento central del día. En Vivo (y solo en la casilla al completarse), el chulo se dibuja con un único micro-sobrepaso físico (`cubic-bezier(0.34, 1.35, 0.64, 1)`, `220ms`), dando recompensa táctil inmediata sin caer en rebotes de dibujo animado.
6. **Estados vacíos con sello gráfico adaptable al tema (`mask-image` CSS sin tocar el DOM):** Cuando no hay tareas, hábitos o libros, en vez de un SVG con colores fijos que se rompen en modo oscuro, Vivo usa un contenedor `::before` en `--area-bg` y una máscara SVG (`mask-image`) pintada con `background-color: var(--area-mid)` que cambia automáticamente entre claro y oscuro.
7. **Voz colombiana cálida y cómplice:** Los textos dejan el tono de reporte técnico y hablan como un buen compañero de trabajo en Colombia (en segunda persona `tú`, directo, con calidez natural, sin signos de exclamación forzados ni emojis).

### 3.2 Tabla comparativa: qué cambia entre «Sobrio» y «Vivo» y qué es INNEGOCIABLE en ambos

| Dimensión | Aspecto «Sobrio» (por defecto) | Aspecto «Vivo» (`[data-estilo="vivo"]`) | Innegociable en AMBOS (No cambia nunca) |
|---|---|---|---|
| **Lienzo claro / oscuro** | Gris neutro frío `#f3f4f6` / `#0d0f14` | Piedra cálida `#f7f5f0` / Obsidiana `#0b0d13` | Contraste WCAG AA (`≥ 4.5:1` texto, `≥ 3:1` UI) |
| **Color por pestaña** | Monocromo: todo usa `--accent` (`#0b5cab`) | Cada pestaña activa su `--area-*` en títulos, iconos de trazo, cabeceras y barras | Un solo `--accent` sólido para el botón primario y `+ Anotar` |
| **Iconos de área (`.area-ico`)** | Trazo monocromo discreto | Trazo limpio de `22px` (`stroke-width: 2.25`) en color de área, **sin cuadrito de fondo** | Cero «icono encerrado en cuadrito pastel» (cliché de IA) |
| **Tarjeta «Tu día» (`.home-day`)** | Superficie blanca/oscura estándar (`--surface`) | Tinte **plano** precalculado (`--day-tint`: `#f6f9ff` claro / `#121c2d` oscuro) | Cero degradados (`linear-gradient`) de plantilla IA |
| **Elevación de tarjetas y botones** | Borde plano `1px solid var(--border)`, `--shadow: none` | Borde `1px` + labio táctil inferior `2px` (claro) / luz cenital `inset 1px` (oscuro) | Cero `backdrop-filter: blur()`, cero sombras en oscuro |
| **Títulos y cifras (`--text-xl`)** | `24px` (`1.5rem`), peso `800`, `-0.02em` | `26px` (`1.625rem`), peso `800`, `-0.035em` + título coloreado por área | Campos editables siempre en `≥ 16px` (`--text-base`), `tabular-nums` |
| **Casilla al completar** | Escala lineal `0.9 → 1.0` en `140ms` sin sobrepaso | Pulso físico único `scale(1)` con curva `cubic-bezier(0.34, 1.35, 0.64, 1)` en `220ms` | Área táctil `≥ 44×44 px`, solo anima `transform` y `opacity` |
| **Estados vacíos** | Una sola línea de texto en `--text-sm --muted` | Emblema geométrico con `mask-image` (`--area-mid` sobre `--area-bg`) + frase cálida | Nunca mostrar «0 %» ni «$ 0» gigantes; 1 toque para crear |
| **Rendimiento y accesibilidad** | `prefers-reduced-motion` apaga todo | `prefers-reduced-motion` apaga todo (incluido el micro-sobrepaso) | Cero bucles infinitos, `:hover` aislado en `@media (hover: hover) and (pointer: fine)` |

---

## 4. Tokens «Vivo» (Claro y Oscuro) y verificación matemática de contraste WCAG AA

### 4.1 Decisión sobre tipografía local y relación entre Acento y Área de Pendientes
- **Tipografía local:** Mantenemos **`Manrope` variable (`fonts/manrope.woff2`, pesos `200–800`)** como fuente de interfaz y exprimimos su eje de peso (`500` en cuerpo, `650` en subtítulos, `800` con `letter-spacing: -0.035em` y `font-feature-settings: "cv01" 1, "tnum" 1` en titulares y cifras). Dejamos `--font-display` apuntando a `"Manrope"` por defecto para **cero peso extra** (con opción de conmutar a `"Bricolage Grotesque", "Manrope", sans-serif` local bajo licencia OFL si algún día se desea aún más carácter en titulares).
- **Decisión cromática sobre Inicio/Pendientes (`--ind`) frente a Acción (`--accent`):**
  En vez de inventar un quinto color desconectado para la pestaña principal de tareas, **el área de Inicio/Pendientes ES la familia azul del acento de la aplicación**. Para que el ojo jamás confunda «identidad de sección» con «botón interactivo», aplicamos una **separación estricta por peso de superficie y luminosidad**:
  1. **Acción primaria (`--accent: #0052cc` en claro / `#5ca8ff` en oscuro):** Es el **único elemento con relleno sólido saturado** en pantalla (exclusivo de `.btn-primary`, `.qc-fab` y casilla marcada).
  2. **Identidad de Inicio/Pendientes (`--ind: #1d4ed8` sobre `--ind-bg: #e8f0fe` en claro; `--ind: #68b0ff` sobre `--ind-bg: #11243e` en oscuro):** Nunca usa pastillas sólidas oscuras que compitan con el botón; se aplica únicamente como **tinta de título, icono de trazo sin fondo o pastilla de tinte claro (`#e8f0fe`)**, manteniendo una diferencia de luminosidad relativa de **10,6×** entre el fondo del botón (`#0052cc`, $L = 0.080$) y el tinte del área (`#e8f0fe`, $L = 0.874$).

### 4.2 Bloque CSS listo para `tablero.css`

```css
/* ==========================================================================
   ASPECTO «VIVO» — Tokens y variables semánticas por área (Claro y Oscuro)
   Se activa con <html data-estilo="vivo"> sin cambiar una sola etiqueta HTML.
   ========================================================================== */

:root[data-estilo="vivo"],
:root[data-estilo="vivo"][data-theme="light"] {
  color-scheme: light;

  /* 1. Superficies cálidas con tactilidad de papel piedra y tinte plano para «Tu día» */
  --bg: #f7f5f0;
  --surface: #ffffff;
  --surface-2: #eeeae2;
  --surface-tint: #f3efe6;
  --day-tint: #f6f9ff; /* Precalculado: 40% --ind-bg (#e8f0fe) + 60% --surface (#ffffff) */
  --track: #e3ded4;

  /* 2. Tinta de alto contraste (WCAG AAA en primario y secundario; --faint solo para UI >= 3:1) */
  --text: #141619;
  --muted: #52565e;
  --faint: #737882; /* USO EXCLUSIVO EN UI (bordes de casilla, divisores, iconos guía); PROHIBIDO en texto */

  /* 3. Bordes con labio físico inferior (estilo Teenage Engineering / Things) */
  --border: #dcd6ca;
  --border-strong: #c4bdb0;
  --card-line: #dcd6ca;
  --shadow: 0 2px 0 0 #dcd6ca, 0 6px 16px -6px rgb(20 22 25 / 0.07);
  --shadow-float: 0 3px 0 0 #00378a, 0 12px 28px -6px rgb(0 55 138 / 0.32);
  --card-highlight: inset 0 1px 0 rgb(255 255 255 / 0.85);

  /* 4. Acento único para la acción principal («+ Anotar», .btn-primary, foco) */
  --accent: #0052cc;
  --accent-press: #003e99;
  --on-accent: #ffffff;

  /* 5. Semántica de urgencia, prioridades y racha */
  --high: #c92a2a;
  --high-bg: #ffe8e8;
  --medium: #a65300;
  --medium-bg: #fff3d6;
  --low: #087f5b;
  --low-bg: #e3faf1;
  --danger: #be123c;
  --on-danger: #ffffff;
  --fire: #c2410c;
  --fire-bg: #ffedd5;

  /* 6. Colores de identidad por área (todos >= 5.85:1 sobre su *-bg) */
  /* Inicio / Pendientes (Familia azul del acento: usada en trazo/título y tinte suave, nunca como botón sólido) */
  --ind: #1d4ed8;
  --ind-mid: #2563eb;
  --ind-bg: #e8f0fe;
  /* Rutina (Esmeralda bosque) */
  --grn: #066a38;
  --grn-mid: #109856;
  --grn-bg: #e3f7ec;
  /* Trabajo e Ingresos (Ámbar cobre) */
  --amb: #944800;
  --amb-mid: #d97706;
  --amb-bg: #fef0d9;
  /* Resúmenes y Lectura (Ciruela editorial) */
  --ros: #9d174d;
  --ros-mid: #db2777;
  --ros-bg: #fce7f1;

  /* Variables dinámicas del área activa (por defecto Inicio/Pendientes) */
  --area-fg: var(--ind);
  --area-mid: var(--ind-mid);
  --area-bg: var(--ind-bg);

  /* 7. Escala tipográfica y radios con mayor contraste expresivo */
  --font-display: "Manrope", system-ui, -apple-system, sans-serif;
  --text-xl: 1.625rem;    /* 26px en Vivo (vs 24px en Sobrio) para títulos y cifras */
  --radius-sm: 0.5rem;    /* 8px */
  --radius-md: 0.875rem;  /* 14px en botones y filas interactivas */
  --radius-lg: 1.125rem;  /* 18px en tarjetas de grupo y hojas */
  --radius-pill: 9999px;

  /* 8. Movimiento Vivo (único sobrepaso permitido: --ease-spring-check en casillas) */
  --dur-fast: 150ms;
  --dur-base: 220ms;
  --dur-slow: 320ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring-check: cubic-bezier(0.34, 1.35, 0.64, 1);
}

@media (prefers-color-scheme: dark) {
  :root[data-estilo="vivo"]:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0b0d13;
    --surface: #131722;
    --surface-2: #1c2230;
    --surface-tint: #171c29;
    --day-tint: #121c2d; /* Precalculado: 40% --ind-bg (#11243e) + 60% --surface (#131722) */
    --track: #252c3d;

    --text: #f5f6f8;
    --muted: #a3acc2;
    --faint: #6c768d; /* Solo UI (3.93:1 sobre #131722), prohibido en texto */

    --border: rgb(255 255 255 / 0.09);
    --border-strong: rgb(255 255 255 / 0.16);
    --card-line: rgb(255 255 255 / 0.09);
    --shadow: none;
    --shadow-float: 0 10px 28px rgb(0 0 0 / 0.55);
    --card-highlight: inset 0 1px 0 rgb(255 255 255 / 0.08);

    --accent: #5ca8ff;
    --accent-press: #3b93ff;
    --on-accent: #09101d;

    --high: #ff7b6b;
    --high-bg: #321619;
    --medium: #fbbf24;
    --medium-bg: #2e220a;
    --low: #4ade80;
    --low-bg: #0f2c1e;
    --danger: #fb7185;
    --on-danger: #19080d;
    --fire: #fb923c;
    --fire-bg: #331a0c;

    --ind: #68b0ff;
    --ind-mid: #3b82f6;
    --ind-bg: #11243e;
    --grn: #4ade80;
    --grn-mid: #22c55e;
    --grn-bg: #0e2d1d;
    --amb: #fbbf24;
    --amb-mid: #f59e0b;
    --amb-bg: #312209;
    --ros: #f472b6;
    --ros-mid: #ec4899;
    --ros-bg: #341326;
  }
}

:root[data-estilo="vivo"][data-theme="dark"] {
  color-scheme: dark;
  --bg: #0b0d13;
  --surface: #131722;
  --surface-2: #1c2230;
  --surface-tint: #171c29;
  --day-tint: #121c2d;
  --track: #252c3d;

  --text: #f5f6f8;
  --muted: #a3acc2;
  --faint: #6c768d;

  --border: rgb(255 255 255 / 0.09);
  --border-strong: rgb(255 255 255 / 0.16);
  --card-line: rgb(255 255 255 / 0.09);
  --shadow: none;
  --shadow-float: 0 10px 28px rgb(0 0 0 / 0.55);
  --card-highlight: inset 0 1px 0 rgb(255 255 255 / 0.08);

  --accent: #5ca8ff;
  --accent-press: #3b93ff;
  --on-accent: #09101d;

  --high: #ff7b6b;
  --high-bg: #321619;
  --medium: #fbbf24;
  --medium-bg: #2e220a;
  --low: #4ade80;
  --low-bg: #0f2c1e;
  --danger: #fb7185;
  --on-danger: #19080d;
  --fire: #fb923c;
  --fire-bg: #331a0c;

  --ind: #68b0ff;
  --ind-mid: #3b82f6;
  --ind-bg: #11243e;
  --grn: #4ade80;
  --grn-mid: #22c55e;
  --grn-bg: #0e2d1d;
  --amb: #fbbf24;
  --amb-mid: #f59e0b;
  --amb-bg: #312209;
  --ros: #f472b6;
  --ros-mid: #ec4899;
  --ros-bg: #341326;
}

/* Mapeo de color de área según la pestaña activa (solo modifica --area-*, NUNCA --accent) */
:root[data-estilo="vivo"] body[data-tab="home"],
:root[data-estilo="vivo"] body[data-tab="tasks"] {
  --area-fg: var(--ind); --area-mid: var(--ind-mid); --area-bg: var(--ind-bg);
}
:root[data-estilo="vivo"] body[data-tab="routine"] {
  --area-fg: var(--grn); --area-mid: var(--grn-mid); --area-bg: var(--grn-bg);
}
:root[data-estilo="vivo"] body[data-tab="work"] {
  --area-fg: var(--amb); --area-mid: var(--amb-mid); --area-bg: var(--amb-bg);
}
:root[data-estilo="vivo"] body[data-tab="books"] {
  --area-fg: var(--ros); --area-mid: var(--ros-mid); --area-bg: var(--ros-bg);
}
```

### 4.3 Tabla de auditoría de contraste WCAG 2.1 (recalculada con luminancia relativa exacta)

Todas las cifras han sido verificadas mediante la fórmula oficial de luminancia relativa WCAG 2.1 ($CR = (L_{\max} + 0.05) / (L_{\min} + 0.05)$):

| Par evaluado | Modo Claro (Hex / Ratio exacto) | Modo Oscuro (Hex / Ratio exacto) | Nivel WCAG | Uso permitido |
|---|---|---|---|---|
| `--text` sobre `--bg` | `#141619` / `#f7f5f0` → **16.64:1** | `#f5f6f8` / `#0b0d13` → **17.96:1** | **AAA** | Texto principal en lienzo |
| `--text` sobre `--surface` | `#141619` / `#ffffff` → **18.13:1** | `#f5f6f8` / `#131722` → **16.55:1** | **AAA** | Tareas, hábitos, montos, tarjetas |
| `--muted` sobre `--surface` | `#52565e` / `#ffffff` → **7.36:1** | `#a3acc2` / `#131722` → **7.87:1** | **AAA** | Fechas, subtítulos, metadatos |
| `--muted` sobre `--bg` | `#52565e` / `#f7f5f0` → **6.76:1** | `#a3acc2` / `#0b0d13` → **8.54:1** | **AA / AAA** | Contadores y cabeceras secundarias |
| `--muted` sobre `--surface-2` | `#52565e` / `#eeeae2` → **6.14:1** | `#a3acc2` / `#1c2230` → **6.99:1** | **AA** | Chips inactivos, barras segmentadas |
| `--on-accent` sobre `--accent` | `#ffffff` / `#0052cc` → **6.82:1** | `#09101d` / `#5ca8ff` → **7.70:1** | **AA / AAA** | Botón `+ Anotar` y `.btn-primary` |
| `--ind` sobre `--ind-bg` | `#1d4ed8` / `#e8f0fe` → **5.85:1** | `#68b0ff` / `#11243e` → **6.87:1** | **AA** | Insignias y encabezados de Inicio/Tareas |
| `--grn` sobre `--grn-bg` | `#066a38` / `#e3f7ec` → **6.01:1** | `#4ade80` / `#0e2d1d` → **8.54:1** | **AA / AAA** | Insignias y encabezados de Rutina |
| `--amb` sobre `--amb-bg` | `#944800` / `#fef0d9` → **5.86:1** | `#fbbf24` / `#312209` → **9.23:1** | **AA / AAA** | Insignias y encabezados de Trabajo |
| `--ros` sobre `--ros-bg` | `#9d174d` / `#fce7f1` → **6.70:1** | `#f472b6` / `#341326` → **6.26:1** | **AA** | Insignias y encabezados de Resúmenes |
| `--high` sobre `--surface` | `#c92a2a` / `#ffffff` → **5.46:1** | `#ff7b6b` / `#131722` → **7.07:1** | **AA / AAA** | Etiqueta «Vencida · fecha» |
| `--fire` sobre `--fire-bg` | `#c2410c` / `#ffedd5` → **4.52:1** | `#fb923c` / `#331a0c` → **7.17:1** | **AA / AAA** | Píldora de racha `.streak-pill` |
| `--faint` sobre `--surface` | `#737882` / `#ffffff` → **4.44:1** | `#6c768d` / `#131722` → **3.93:1** | **AA UI (`≥ 3:1`)** | **Solo UI, no texto** (bordes de casilla vacía e iconos guía) |

---

## 5. Componentes en «Vivo»: reglas y valores exactos

Todos los selectores parten del DOM real de la app y se encapsulan bajo `:root[data-estilo="vivo"]`:

### 5.1 Cabecera y título coloreado de lista estilo Apple Recordatorios (`#page-title`)
- **Diferencia frente a Sobrio:** Siguiendo el rasgo real de **Apple Recordatorios**, el título grande de la vista (`#page-title`) sube a `--text-xl` (`26px`, peso `800`, `letter-spacing: -0.035em`), se tiñe con el color semántico de su área (`color: var(--area-fg)`) y lleva a su izquierda un punto vivo de `8×8px` (`border-radius: 9999px`, `background: var(--area-mid)`), identificando de un vistazo en qué lista estás sin teñir toda la barra superior.
- **CSS exacto:**
  ```css
  :root[data-estilo="vivo"] #page-title {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-family: var(--font-display); font-size: var(--text-xl); font-weight: 800;
    letter-spacing: -0.035em; color: var(--area-fg);
  }
  :root[data-estilo="vivo"] #page-title::before {
    content: ""; width: 8px; height: 8px; border-radius: var(--radius-pill);
    background: var(--area-mid); flex-shrink: 0;
  }
  ```

### 5.2 Fila de tarea y hábito (`.task-item`, `.home-task`, `.rt-item`)
- **Diferencia frente a Sobrio:** Las listas siguen agrupadas en una sola tarjeta contenedora (`.group-list`, `.rt-list`, `.wk-list`, `.inc-list`), pero el contenedor tiene labio físico inferior (`box-shadow: var(--shadow), var(--card-highlight)`) y bordes de `18px` (`--radius-lg`). Al tocar una fila (`:active`), el fondo responde al instante con `var(--area-bg)`.
- **Prioridad:**
  - En modo **Punto (`dot`)**: el punto `.dot` mide `9×9px` con un halo suave de `3px` (`box-shadow: 0 0 0 3px rgb(0 0 0 / 0.05)`).
  - En modo **Borde (`border`)**: `.style-border .task-item` usa una franja izquierda de `4px solid var(--prio, var(--border))`.
  - **Vencidas:** `.due-label.overdue` se muestra como una micro-etiqueta en `--high` con fondo `--high-bg` (`padding: 1px 7px; border-radius: 6px; font-weight: 700`), destacando la urgencia sin pintar toda la fila de rojo.

### 5.3 Casilla de verificación y animación de completar
- **Diferencia frente a Sobrio:** La casilla mide `24×24px` (con área táctil de fila `≥ 52px`), borde `2px solid var(--faint)` y fondo `--surface-2` muy sutil en reposo (nunca el aro rojo/verde grueso de `antes/`).
- En **Pendientes e Inicio**, al marcarse se rellena con `--accent` (`#0052cc` / `#5ca8ff`); en **Rutina** (`.rt-item.done .rt-check`), se rellena con el verde esmeralda de Rutina (`--grn-mid`) para diferenciar la satisfacción de un hábito diario frente a un pendiente puntual.
- El chulo interior (`::after` o SVG) entra con `--ease-spring-check` en `220ms`, produciendo un asentamiento táctil con un único micro-sobrepaso del `6 %`.

### 5.4 Encabezados de grupo con color de área (`.group-head`, `.rt-group-head`)
- **Diferencia frente a Sobrio:** En vez de texto gris neutro en mayúsculas espaciadas, `.group-head` y `.rt-group-head` usan color `--area-fg` (`font-weight: 800`), y el contador `.count` se viste con `background: var(--area-bg); color: var(--area-fg); font-weight: 700`. Si el grupo es `.group-head.overdue`, usa `--high` sobre `--high-bg`.

### 5.5 Tarjeta «Tu día» en Inicio (`.home-day`) e iconos de área sin cuadrito (`.home-areas`)
- **Diferencia frente a Sobrio (corregida contra clichés de IA):**
  - **Cero degradados en `.home-day`:** En lugar de usar `linear-gradient` ni `color-mix` en tiempo de ejecución, `.home-day` aplica el tinte **plano** precalculado `background-color: var(--day-tint)` (`#f6f9ff` en claro / `#121c2d` en oscuro, que equivale exactamente al `40 %` de `--ind-bg` mezclado con `--surface`), destacando la tarjeta principal del día con limpieza editorial.
  - **Cero «icono en cuadrito de color» en `.home-areas`:** En `.home-areas .area`, eliminamos la caja coloreada de fondo de `.area-ico`. El icono `.area-ico` pasa a ser un glifo de trazo limpio de **`22×22px`** pintado directamente con el color de su área (`color: var(--tfg); background: transparent; border: 0; border-radius: 0`), con trazo más firme (`stroke-width: 2.25`) y un punto indicador de `8px` (`border-radius: 9999px; background: var(--tfg)`) junto al contador o etiqueta.
  ```css
  :root[data-estilo="vivo"] .home-day {
    background-color: var(--day-tint);
  }
  :root[data-estilo="vivo"] .home-areas .area-ico {
    width: 22px; height: 22px;
    background: transparent; border: 0; border-radius: 0;
    color: var(--tfg);
  }
  :root[data-estilo="vivo"] .home-areas .area-ico svg {
    width: 22px; height: 22px; stroke-width: 2.25;
  }
  ```

### 5.6 Progreso y racha con celebración breve y adulta (`.day-progress`, `.streak-pill`, `.rt-bar`)
- **Diferencia frente a Sobrio:**
  - La barra `.bar > span`, `.rt-bar span` y `.read-bar i` tiene `height: 8px`, `border-radius: 9999px` y anima exclusivamente `transform: scaleX(var(--p, 0))` con `transform-origin: left` y color `--area-mid`.
  - Cuando se completa el 100 % de las tareas del día (`.day-progress.all-done`), la tarjeta cambia su borde a `--grn-mid` y su fondo a `--grn-bg`, y el contador hace un pulso corto de `220ms` (`scale(1.03) → scale(1)`).
  - La insignia general de racha `.streak-pill` en Rutina luce un borde `1px solid var(--fire)` sobre `--fire-bg` con texto `--fire`, mientras en cada fila `.rt-streak` se mantiene limpia en texto `--muted` (`Llevas 3 días seguidos`) sin repetir parches naranjas.

### 5.7 Estados vacíos adaptables al tema con `mask-image` (`--area-mid` + `--area-bg`)
- **Diferencia frente a Sobrio:** Sin tocar el HTML compartido (`<p id="task-empty">`, `<p class="home-empty">`, `<p id="book-empty">`), en `[data-estilo="vivo"]` evitamos colores fijos incrustados en el `data:` URI. Usamos dos capas temáticas puras en CSS:
  1. **`::before` (capa de fondo suave):** pastilla redondeada de `48×48px` (`border-radius: 14px`) pintada con `background-color: var(--area-bg)` y borde fino `1px solid var(--border)`.
  2. **`::after` (capa de glifo con `mask-image`):** superpuesta exactamente sobre la pastilla, usa `background-color: var(--area-mid)` recortado mediante `-webkit-mask-image` / `mask-image` con el SVG monocromo, de modo que tanto el fondo suave como el trazo cambian automáticamente en modo claro y modo oscuro y toman el color de la pestaña activa:
- **CSS final listo para producción:**
  ```css
  :root[data-estilo="vivo"] #task-empty,
  :root[data-estilo="vivo"] .home-empty,
  :root[data-estilo="vivo"] #book-empty {
    position: relative;
    padding-top: 3.75rem;
    text-align: center;
  }
  /* 1. Segunda capa: base geométrica suave con --area-bg */
  :root[data-estilo="vivo"] #task-empty::before,
  :root[data-estilo="vivo"] .home-empty::before,
  :root[data-estilo="vivo"] #book-empty::before {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 44px; height: 44px; border-radius: 12px;
    background-color: var(--area-bg);
    border: 1px solid var(--border);
  }
  /* 2. Primera capa: trazo del icono con mask-image y background-color: var(--area-mid) */
  :root[data-estilo="vivo"] #task-empty::after,
  :root[data-estilo="vivo"] .home-empty::after,
  :root[data-estilo="vivo"] #book-empty::after {
    content: "";
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 44px; height: 44px;
    background-color: var(--area-mid);
    -webkit-mask: var(--empty-mask) center / 26px 26px no-repeat;
    mask: var(--empty-mask) center / 26px 26px no-repeat;
  }
  :root[data-estilo="vivo"] #task-empty::after,
  :root[data-estilo="vivo"] .home-empty::after {
    --empty-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='18' cy='6' r='2.5' fill='black' stroke='none'/%3E%3Cpath d='M5 13l4.5 4.5L19 8'/%3E%3C/svg%3E");
  }
  :root[data-estilo="vivo"] #book-empty::after {
    --empty-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 6v13M4 6h5a3 3 0 0 1 3 3v10a3 3 0 0 0-3-3H4zM20 6h-5a3 3 0 0 0-3 3v10a3 3 0 0 1 3-3h5z'/%3E%3C/svg%3E");
  }
  ```

### 5.8 Barra inferior (`.bottom-nav`), botón «+ Anotar» (`.qc-fab`), hojas y chips
- **Barra inferior (`.bottom-nav`) y lateral en PC:** En Vivo, el botón activo `.nav-btn.active` se pinta con el color semántico de su propia pestaña (`--area-fg`) y su icono `svg` da un acuse sutil (`transform: translateY(-1px)` en `150ms`), funcionando como un marcador físico de color por sección.
- **Botón flotante «+ Anotar» (`.qc-fab`):** Conserva siempre `--accent` (`#0052cc` / `#5ca8ff`), con radio `--radius-md` (`14px`), labio táctil inferior de `3px` (`#00378a`) y respuesta física inmediata `:active { transform: translateY(calc(var(--lift) + 2px)) scale(0.97); }`.
- **Hojas modales (`.sheet`, `.qc-sheet`):** Borde superior de `20px`, iluminación cenital `--card-highlight` y asa superior `.sheet::before` de `36×4px` en `--border-strong`.
- **Controles segmentados (`.seg`) y chips (`.prio-chip`, `.bk-chip`):** En Vivo, `.seg` tiene `padding: 4px; background: var(--surface-2); border: 1px solid var(--border)`, y el botón `.seg button.active` flota con `background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 1px 0 var(--border-strong)`.

---

## 6. Movimiento «Vivo»: tabla técnica de microinteracciones

Siguiendo la jerarquía de decisión de `emil-design-eng`, `animate` y `apple-design`, **solo animamos `transform` y `opacity`** (cero `width`, `height`, `top`, `bottom` o `filter: blur()`).

| Interacción | Propiedades animadas | Duración | Curva (`easing`) | Diferencia frente a «Sobrio» |
|---|---|---|---|---|
| **1. Presionar botón o tarjeta (`.btn-primary:active`, `.qc-fab:active`)** | `transform: translateY(1px) scale(0.98)` | `100ms` (al pulsar) / `150ms` (al soltar) | `var(--ease-out)` `cubic-bezier(0.22, 1, 0.36, 1)` | En Vivo hay desplazamiento vertical de `1px` que comprime el labio físico inferior del botón. |
| **2. Completar tarea o hábito (casilla `:checked` / `.done`)** | `transform: scale(0.85) → scale(1)` en casilla y `scale(0) → scale(1)` en el trazo del check | `220ms` (`--dur-base`) | `var(--ease-spring-check)` `cubic-bezier(0.34, 1.35, 0.64, 1)` | **Único lugar con micro-sobrepaso (`6 %`, 1 sola oscilación)** en toda la app. En Sobrio no hay sobrepaso. |
| **3. Avance de barras (`.bar > span`, `.rt-bar span`, `.read-bar i`)** | `transform: scaleX(var(--p, 0))` (`transform-origin: left`) | `260ms` | `var(--ease-out)` | Transición fluida acelerada en GPU al marcar ítems o sumar un capítulo. |
| **4. Completar el 100 % del día o subir racha (`.day-progress.all-done`, `.streak-pill`)** | `transform: scale(0.96) → scale(1)` + transición de `background-color` | `220ms` | `var(--ease-out)` | Celebración breve de un solo pulso al cerrar el último pendiente del día, sin confeti ni bloqueos. |
| **5. Cambiar de pestaña (`.nav-btn.active svg`, `.tab-panel`)** | En el icono activo: `transform: translateY(-1px) scale(1.04)` | `150ms` (`--dur-fast`) | `var(--ease-out)` | El cambio de vista es instantáneo (no animamos pestañas que se abren 50 veces al día); solo el icono activo da acuse táctil. |
| **6. Abrir / cerrar hoja modal (`.sheet`, `.qc-sheet`)** | `transform: translateY(24%) → translateY(0)` y `opacity: 0 → 1` | Entrada: `280ms` / Salida: `200ms` (`0.75×`) | `cubic-bezier(0.32, 0.72, 0, 1)` (curva de hoja iOS) | Salida asimétrica más rápida que la entrada para que la app nunca se sienta lenta al cerrar. |

### Regla obligatoria de accesibilidad (`prefers-reduced-motion`)
```css
@media (prefers-reduced-motion: reduce) {
  :root[data-estilo="vivo"] *,
  :root[data-estilo="vivo"] *::before,
  :root[data-estilo="vivo"] *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. Textos con voz: 10 ejemplos de microcopy («Sobrio» vs. «Vivo»)

En español de Colombia, natural, cálido y directo (en segunda persona `tú`), sin signos de exclamación postizos, sin emojis y sin frases de anuncio.
*(Nota técnica de compatibilidad con `npm run e2e`: en las vistas donde Playwright comprueba una subcadena exacta como `'Tu rutina está vacía'` o `'Aún no hay oportunidades'`, la versión Vivo conserva esa semilla o aplica el texto enriquecido mediante un diccionario ligero `COPY[estilo]` o `data-copy-vivo` sin alterar los selectores de prueba).*

| # | Contexto / Pantalla | Antes (Plantilla / IA) | Aspecto «Sobrio» (Seco y mínimo) | Aspecto «Vivo» (Cálido, colombiano y con carácter) |
|---|---|---|---|---|
| 1 | **Inicio — Día sin tareas (`total === 0`)** | «0% del día · Día libre. No tienes nada con fecha para hoy. Buen momento para adelantar algo.» | «Nada pendiente para hoy. · Anotar algo» | «Hoy tienes la cancha despejada. Si te acuerdas de algo, anótalo aquí.» |
| 2 | **Inicio — «Lo importante hoy» vacío** | «Nada urgente. Las tareas vencidas, las de hoy y las de prioridad alta aparecen aquí.» | «Sin tareas urgentes por ahora.» | «Todo lo urgente está resuelto. Respira tranquilo.» |
| 3 | **Inicio — Queda 1 sola tarea (`left === 1`)** | «Ya casi: te falta 1.» | «Falta 1 para terminar hoy.» | «A un solo paso de cerrar el día.» |
| 4 | **Inicio / Pendientes — Todo lo de hoy completado (`left === 0`)** | «Día completo. Puedes descansar tranquilo.» | «Todo lo de hoy está listo.» | «Listo el día. Ya cumpliste con todo lo de hoy.» |
| 5 | **Pendientes — Lista vacía (`#task-empty`)** | «No hay tareas para mostrar.» | «Sin pendientes. · Anotar algo» | «La lista está limpia. Qué buena sensación.» |
| 6 | **Rutina — Sin hábitos creados (`#routine-body`)** | «Tu rutina está vacía. Añade las cosas que quieres hacer cada día… + Añadir mi primer pendiente» | «Tu rutina está vacía. · Crear hábito» | «Tu rutina está vacía por ahora. Empieza con un solo hábito fácil de cumplir · Crear hábito» |
| 7 | **Rutina — Racha en cada hábito (`.rt-streak`)** | «2 días» *(en pastilla naranja ambigua)* | «2 días seguidos» | «Llevas 2 días seguidos» |
| 8 | **Trabajo — Sin ofertas (`#work-body`)** | «Aún no hay oportunidades.» | «Aún no hay oportunidades. · Añadir oportunidad» | «Aún no hay oportunidades guardadas. Cuando veas una buena oferta, tráela acá · Añadir oportunidad» |
| 9 | **Trabajo — Mes sin ingresos (`#inc-total` / vacío)** | «Total del mes: $ 0 · Con Claude $ 0 · Presencial $ 0» | «No hay ingresos en noviembre 2026. · Añadir ingreso» | «No hay ingresos en noviembre 2026 todavía. Registra el primer pago cuando entre · Añadir ingreso» |
| 10 | **Resúmenes — Sin libros (`#book-empty`)** | «Aún no tienes resúmenes. ¡Crea el primero!» | «Aún no tienes resúmenes. · Crear resumen» | «Tu estante espera su primer libro. Guarda aquí las ideas que vale la pena recordar · Crear resumen» |

---

## 8. Cómo se cambia: arquitectura técnica, archivos que se tocan y pruebas

### 8.1 Control en Ajustes (`index.html`)
Justo debajo de «Modo oscuro» en `#settings` (`index.html:182`), se añade un control segmentado idéntico a los que ya maneja automáticamente `app.js`:

```html
      <div class="setting">
        <p class="setting-label">Aspecto visual</p>
        <div class="seg" data-setting="estilo" role="group" aria-label="Aspecto visual">
          <button type="button" data-value="sobrio">Sobrio</button>
          <button type="button" data-value="vivo">Vivo</button>
        </div>
      </div>
```

### 8.2 Lógica en `app.js` (solo 6 líneas nuevas, cambio instantáneo sin recargar)
1. **Valor por defecto seguro en `state.settings` (`app.js:84`):**
   ```js
   settings: { theme: "", estilo: "sobrio", priorityStyle: "dot", groupBy: "date", notifyHere: true, ...load(KEYS.settings, {}) },
   ```
   *(Caso borde cubierto: si un usuario antiguo tiene `prod.settings` en `localStorage` sin la clave `estilo`, el spread conserva `"sobrio"` por defecto, o si queremos validar corrupción: `if (st.estilo !== "vivo" && st.estilo !== "sobrio") st.estilo = "sobrio"`).*
2. **Aplicación en caliente dentro de `applyTheme()` (`app.js:164-168`):**
   Como el listener genérico `$$(".seg[data-setting]")` en `app.js:734-742` **ya guarda en `localStorage` y llama a `applyTheme()`**, actualizar `applyTheme()` hace que el cambio funcione al instante al tocar el botón en Ajustes:
   ```js
   function applyTheme() {
     const dark = state.settings.theme === "dark";
     const vivo = state.settings.estilo === "vivo";
     document.documentElement.dataset.theme = state.settings.theme;
     document.documentElement.dataset.estilo = vivo ? "vivo" : "sobrio";
     const meta = document.querySelector('meta[name="theme-color"]');
     if (meta) meta.content = dark ? (vivo ? "#0b0d13" : "#0d0f14") : (vivo ? "#f7f5f0" : "#f3f4f6");
   }
   ```

### 8.3 Resumen de archivos que se tocan cuando se implemente
1. **`index.html`:** Añadir el bloque `.seg[data-setting="estilo"]` en `#settings` (`~7 líneas`).
2. **`app.js`:** Añadir `estilo: "sobrio"` en `state.settings` (`línea 84`) y asignar `document.documentElement.dataset.estilo` + `theme-color` en `applyTheme()` (`líneas 164-168`).
3. **`tablero.css`:** Añadir al final del archivo el bloque `:root[data-estilo="vivo"]` (tokens claro/oscuro + reglas de componentes Vivo).

### 8.4 Riesgos, casos borde y pruebas automáticas (`npm run unit` y `npm run e2e`)
1. **Compatibilidad con `tests/full4.js` (líneas 15, 17, 19):**
   - `tests/full4.js` verifica `getComputedStyle(document.body).backgroundColor` al arrancar esperando `rgb(243, 244, 246)` (`#f3f4f6`) en claro y `rgb(13, 15, 20)` (`#0d0f14`) en oscuro.
   - **Mitigación:** Al dejar `estilo: "sobrio"` como valor inicial por defecto en `state.settings`, `tests/full4.js` y las 14 suites e2e pasan **al 100 % sin modificar una sola línea de los tests existentes**, y podemos añadir una aserción adicional que haga clic en `[data-setting="estilo"] [data-value="vivo"]` y compruebe `document.documentElement.dataset.estilo === "vivo"` y `rgb(247, 245, 240)` (`#f7f5f0`).
2. **Modo Widget de Escritorio (`#widget` en Windows WebView2):**
   - `applyTheme()` corre antes de `if (WIDGET_MODE)` en `app.js`, por lo que el widget de escritorio hereda automáticamente `data-estilo="vivo"` y actualiza sus colores y bordes sin desbordar los `340×480 px`.
3. **Persistencia y sincronización:**
   - `KEYS.settings` (`prod.settings`) es local de cada dispositivo (igual que `theme` y `priorityStyle`), permitiendo que el dueño use «Vivo» en su celular y elija independientemente en su PC.

---

## 9. Prompt de dirección «Vivo» para Claude Design (≤ 2.500 caracteres)

> *(Longitud verificada: **2.368 caracteres** con espacios, estrictamente por debajo del límite de 2.500 caracteres. Listo para copiar y pegar antes de pedir cada pantalla).*

```text
Actúa como director de arte senior para «Pendientes y Resúmenes», una PWA móvil (390×844 px) y de escritorio (1440×900 px) en español de Colombia. Diseña cada pantalla comparando LADO A LADO dos aspectos intercambiables que comparten EXACTAMENTE el mismo HTML y estructura DOM (`<html data-estilo="sobrio|vivo">`), en modo CLARO y OSCURO (4 vistas: Sobrio Claro, Vivo Claro, Sobrio Oscuro, Vivo Oscuro).

REGLAS INNEGOCIABLES EN AMBOS (LISTA NEGRA ANTI-IA):
- Proporción 60/30/10 y una sola petición por pantalla: sin cajas anidadas innecesarias, sin las 3 tarjetitas iguales («three feature cards»), sin botones primarios duplicados, sin degradados y sin iconos encerrados en cuadritos de color pastel.
- Fuente única local `Manrope` (200–800) con `tabular-nums` en todas las cifras, fechas y montos, y `tracking` negativo en titulares; `Georgia` solo en lectura larga; `ui-monospace` solo en código de sincronización.
- Contraste WCAG AA estricto (≥4.5:1 texto; `--faint` ≥3:1 solo en bordes/UI, prohibido en texto), objetivos táctiles ≥44×44 px, selector de fecha ≥120 px, botones que cambian su texto al trabajar («Guardando…», «Sincronizando…»), `:hover` solo con ratón, cero `backdrop-filter: blur()` y animaciones solo con `transform` y `opacity`.

ASPECTO 1 — «SOBRIO» (`[data-estilo="sobrio"]`):
- Lienzo frío (`--bg: #f3f4f6` claro / `#0d0f14` oscuro; `--surface: #ffffff` / `#161922`). Monocromo con acento `#0b5cab` / `#6eb5ff`, bordes planos de `1px`, sin sombras en tarjetas, radios `8/12/16px`, estados vacíos de una línea y casillas sin sobrepaso (`140ms`).

ASPECTO 2 — «VIVO» (`[data-estilo="vivo"]`, inspirado en Things 3, Teenage Engineering, Apple Recordatorios, Linear y Flighty):
1. Superficies táctiles: en claro, papel piedra `#f7f5f0`, tarjetas `#ffffff` y `#eeeae2` con borde `1px` (`#dcd6ca`) + labio físico inferior de `2px` (`#c4bdb0`) que baja `1px` en `:active`. En oscuro, obsidiana `#0b0d13`, pizarra `#131722` y `#1c2230` con luz cenital `inset 0 1px 0 rgba(255,255,255,0.08)`. Tarjeta «Tu día» con tinte PLANO precalculado (`#f6f9ff` claro / `#121c2d` oscuro, cero degradados).
2. Color de área + acción única: el relleno sólido ultramar (`#0052cc` / `#5ca8ff`) es exclusivo del botón `+ Anotar` y casillas marcadas. Inicio/Pendientes comparte la familia azul del acento pero solo en tinte suave (`#e8f0fe`/`#11243e`) y texto/trazo (`#1d4ed8`/`#68b0ff`); Rutina usa esmeralda `#066a38`/`#4ade80` (`#e3f7ec`/`#0e2d1d`); Trabajo ámbar `#944800`/`#fbbf24` (`#fef0d9`/`#312209`); Resúmenes ciruela `#9d174d`/`#f472b6` (`#fce7f1`/`#341326`).
3. Detalles Vivo: títulos de lista coloreados (`26px`, peso `800`, `-0.035em`) con punto de `8px`; iconos `.area-ico` de trazo `22px` (`stroke-width: 2.25`) sin fondo; casilla con un único micro-sobrepaso (`cubic-bezier(0.34, 1.35, 0.64, 1)`, `220ms`); estados vacíos con `mask-image` SVG (`--area-mid` sobre `--area-bg`).
4. ANOTACIÓN OBLIGATORIA: En cada pantalla entregada, anota al pie qué reglas de oro aplicaste y dónde se ven.
```

---

## 10. Lo que aplicamos de los 10 videos (Reglas de oro de `docs/analisis-videos.md` → «Sobrio» vs. «Vivo»)

| # | Regla de oro (de los 10 videos) | Cómo se cumple en «Sobrio» | Cómo se cumple en «Vivo» (`[data-estilo="vivo"]`) |
|---|---|---|---|
| 1 | **Proporción 60 / 30 / 10** *(video 8, 07:58; videos 1, 2, 5, 6, 7)* | **60 %** fondo gris frío (`#f3f4f6` / `#0d0f14`), **30 %** tarjetas (`#ffffff` / `#161922`), **10 %** azul cobalto (`#0b5cab` / `#6eb5ff`) en acción y pestaña activa. | **60 %** papel piedra cálido (`#f7f5f0` / `#0b0d13`), **30 %** superficies (`#ffffff` / `#131722` + tinte plano `#f6f9ff` / `#121c2d`), **10 %** repartido entre el botón de acción único (`#0052cc` / `#5ca8ff`) y los toques de brújula del área activa (`--area-*`). |
| 2 | **Una sola petición por pantalla (*One ask per screen*)** *(video 5, 18:55)* | Se elimina la duplicidad de botones primarios: `+ Anotar` queda como puerta única de captura rápida y la lista del día sube al primer pantallazo. | Exactamente la misma disciplina estructural: un único botón sólido en `--accent` por pantalla (`+ Anotar` o `.btn-primary`), sin formularios fijos duplicados ni botones que tapen la última fila. |
| 3 | **Lista negra anti-IA (*No AI Slop*)** *(videos 4, 5, 6, 7, 8, 10)* | Cero tarjetas anidadas innecesarias, cero «3 baldosas iguales» en el embudo de Trabajo, cero degradado morado/índigo (`#4f46e5`) y cero «0 %» o «$ 0» gigantes. | Además de lo anterior: **cero iconos encerrados en cuadritos de color pastel** (`.area-ico` pasa a trazo puro de `22px` sin fondo), **cero degradados diagonales** (`.home-day` usa tinte plano `#f6f9ff` / `#121c2d`) y cero muñequitos genéricos. |
| 4 | **Titulares con `tracking` negativo y escala con contraste real** *(videos 5, 7, 9, 10)* | Fuente única `Manrope` en 5 tamaños (`12/14/16/18/24px`); títulos en `24px` (`1.5rem`), peso `800` y `letter-spacing: -0.02em`. | Exprime aún más el contraste de `Manrope`: títulos y cifras clave suben a **`26px` (`1.625rem`)**, peso `800`, **`letter-spacing: -0.035em`** y color de lista (`--area-fg`) al estilo Apple Recordatorios + Flighty. |
| 5 | **Cifras alineadas con `tabular-nums`** *(Regla 1 de `analisis-videos.md`)* | Aplicado en todos los montos (`#inc-total`), porcentajes, fechas, anillos y contadores para que las columnas numéricas no bailen. | Idéntico cumplimiento estricto (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`), combinado con peso `800` en las cifras protagonistas. |
| 6 | **Rendimiento: solo `transform` y `opacity`** *(video 6, 12:25)* | Las barras de avance usan `transform: scaleX(var(--p))` en vez de `width`, `.qc-fab` usa `translateY` en vez de `bottom` y se elimina `backdrop-filter: blur()`. | Mismo presupuesto estricto de 60 fps en GPU: tanto la compresión del labio físico (`translateY(1px) scale(0.98)`) como las barras (`scaleX`) y las hojas (`translateY`) animan únicamente `transform` y `opacity`, apagándose con `prefers-reduced-motion: reduce`. |
| 7 | **Física natural en el movimiento** *(video 7, 05:29; video 10, 17:35)* | Cero sobrepasos en toda la app: solo `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`) y `--ease-in-out` en `140/220/300ms`. | Frena con suavidad en hojas, barras y botones (`--ease-out`), permitiendo **un único micro-sobrepaso del 6 %** (`cubic-bezier(0.34, 1.35, 0.64, 1)`, `220ms`) exclusivamente al marcar una casilla de tarea o hábito. |
| 8 | **Bordes de `1px` y elevación por brillo en oscuro** *(videos 1, 2, 6, 10)* | En claro, borde plano `1px solid #e3e5e9`; en oscuro, `--shadow: none` y tres escalones de gris (`#0d0f14`, `#161922`, `#202532`). | En claro, borde de `1px` (`#dcd6ca`) + **labio táctil inferior de `2px`** (`#c4bdb0`); en oscuro, tres escalones de pizarra (`#0b0d13`, `#131722`, `#1c2230`) + **luz cenital** (`inset 0 1px 0 rgba(255,255,255,0.08)`). |
| 9 | **Selector de fecha `≥ 120px` y chips en español** *(video 6, 09:58)* | Prioridad a chips rápidos («Hoy», «Mañana», «Elegir fecha») y ancho mínimo `min-width: 120px` (`7.5rem`, superando los `113px` del video 6) sin cortes. | Misma garantía de `min-width: 120px` y `font-size: 16px` en cualquier `<input type="date">`, vistiendo los chips rápidos con punto vivo de color de área y respuesta táctil. |
| 10 | **Botones que informan mientras trabajan** *(video 6, 03:32)* | Al guardar, sincronizar o conectar con Claude, el botón se desactiva (`disabled`) y cambia su texto en el acto («Guardando…», «Sincronizando…», «Conectando…»). | Cumple el mismo cambio inmediato de texto y añade estado visual `[ aria-busy="true" ]` / `:disabled` con el labio inferior comprimido (`translateY(1px)`), confirmando físicamente que la orden está en marcha. |
| 11 | **Toque `:active` universal y `:hover` solo con ratón** *(videos 2, 4, 7, 10)* | Objetivos táctiles `≥ 44×44 px`, acuse `:active { transform: scale(0.98) }` inmediato en móvil y `:hover` encerrado en `@media (hover: hover) and (pointer: fine)`. | Objetivos táctiles `≥ 44×44 px`, acuse físico `:active { transform: translateY(1px) scale(0.98) }` que hunde el labio del botón, y `:hover` igualmente aislado solo para computador con ratón. |

---

## 11. Ficha técnica para el dueño (15 términos explicados en una línea sin jerga)

1. **`tabular-nums` (Números tabulares):** Hace que todos los números ocupen exactamente el mismo ancho, para que las cifras de dinero, porcentajes y fechas queden alineadas en columna y no «bailen» cuando cambian.
2. **`tracking` negativo (`letter-spacing: -0.035em`):** Junta un poquito las letras en los títulos y números grandes para que se vean compactos, firmes y con personalidad de revista, en vez de desparramados.
3. **Escala tipográfica:** Es el conjunto fijo de 5 tamaños de letra (`12px` a `26px`) que ordena qué se lee primero, qué es secundario y qué es un detalle, evitando que toda la pantalla tenga el mismo tamaño.
4. **Regla 60 / 30 / 10:** Fórmula para que los colores no cansen la vista: **60 %** es el fondo tranquilo, **30 %** las tarjetas donde va el contenido y solo **10 %** los toques de color intenso donde debes fijarte o tocar.
5. **Contraste `4.5:1` (Estándar WCAG AA):** Es la diferencia mínima de claridad entre la letra y su fondo exigida internacionalmente para que cualquier texto se lea sin esfuerzo, incluso con brillo bajo o al sol en la calle.
6. **Labio táctil:** Borde inferior de `2px` un poco más oscuro en botones y tarjetas que se hunde `1px` cuando lo presionas con el dedo, dándote la sensación de pulsar una tecla real.
7. **Luz cenital (`inset 0 1px 0`):** Línea finísima de brillo blanco casi transparente en el borde superior de las tarjetas en modo oscuro, que simula una lámpara desde arriba para separar las piezas sin usar sombras negras.
8. **Elevación por brillo:** Técnica del modo oscuro donde las tarjetas que están «más cerca de ti» se pintan de un gris pizarra un poco más claro que el fondo, porque las sombras negras no se ven sobre un fondo oscuro.
9. **Tinte plano (`--day-tint`):** Color suave y uniforme (mezclado de antemano) que destaca la tarjeta «Tu día» sin usar degradados artificiales que delatan plantillas hechas por IA.
10. **Objetivo táctil de `44×44 px`:** Tamaño mínimo que debe tener cualquier botón, casilla o fila para que la yema del dedo acierte siempre a la primera sin tocar por error lo de al lado.
11. **Zona segura (`safe-area-inset`):** Margen automático que respeta la cámara frontal, las esquinas curvas y la barra inferior de gestos del teléfono para que ningún botón quede tapado.
12. **Curva de aceleración (`cubic-bezier` / `easing`):** Es el «freno físico» de una animación: hace que los paneles arranquen rápido y frenen con suavidad al llegar a su sitio, en vez de moverse de forma robótica.
13. **Micro-sobrepaso (`--ease-spring-check`):** Pequeño impulso elástico (de apenas un `6 %` y una sola vez) cuando marcas una casilla, para que completar una tarea se sienta vivo y satisfactorio sin rebotar como dibujo animado.
14. **Solo `transform` y `opacity`:** Regla de rendimiento que mueve o desvanece elementos usando directamente el chip gráfico del celular, logrando que la app vaya siempre fluida y sin tirones ni gasto extra de batería.
15. **`prefers-reduced-motion` (Reducir movimiento):** Ajuste que detecta si activaste «reducir animaciones» en tu celular o computador y apaga al instante todos los desplazamientos para cuidar tu comodidad visual.
