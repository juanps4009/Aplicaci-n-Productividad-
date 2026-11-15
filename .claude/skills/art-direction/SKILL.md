---
name: art-direction
description: Dirección de arte de «Pendientes y Resúmenes». Úsala SIEMPRE antes de crear, rediseñar, ajustar o revisar cualquier cosa visual de la app (index.html, *.css, textos de la interfaz, estados vacíos, animaciones, colores, tipografía, espaciado, modo oscuro, widget de escritorio) y cuando el dueño diga que algo «se ve feo», «se ve de IA», «está desordenado» o pida «ponlo más bonito». Contiene la lista negra anti «AI slop», los tokens (tipografía, color, radios, movimiento) y el protocolo previo obligatorio.
---

# Dirección de arte — Pendientes y Resúmenes

Fuente: análisis de 10 videos de diseño filtrado por Gemini y Claude (`docs/analisis-videos.md`) + auditoría del código. Guía para el dueño: `GUIA-DISENO-Y-CONTROL-CLAUDE.md`.

La app es una herramienta de uso diario en el **celular** (Android, Chrome/Brave), también en computador y en un widget de escritorio. HTML/CSS/JS puros, sin librerías ni build. Los tokens viven en `:root` de `tablero.css` (que se carga después de `styles.css` y manda). Idea rectora: **la lista del día es la protagonista; todo lo demás se aparta.**

## 0. Protocolo previo (obligatorio, antes de escribir CSS o HTML)

Escribe en tu respuesta, en 4–6 líneas, antes de tocar código:
1. **Una sola petición por pantalla:** ¿qué es lo único que la persona viene a hacer aquí? Eso va primero y con el único acento.
2. **Jerarquía en 3 niveles:** qué es primario (tamaño/peso), secundario (`--muted`) y terciario (`--text-xs`, o se oculta).
3. **Densidad:** ¿qué se ve sin hacer scroll en un celular de 390×844? Las tareas del día deben aparecer en el primer pantallazo.
4. **Estados:** vacío, cargando/trabajando, error, uno, muchos, texto larguísimo. Cada uno con su diseño.
5. **Tokens que vas a usar.** Si necesitas un valor que no está en la lista, para y justifícalo; no inventes uno suelto.
6. Después de cambiar: captura en 390 px claro **y** oscuro con Playwright, mírala de verdad, y corre `npm run e2e` y `npm run unit`.

## 1. Lista negra «anti AI slop» (prohibido)

- El índigo/violeta por defecto (`#4f46e5`, `#6366f1`, `#818cf8`) y cualquier degradado morado-azul o morado-rosa.
- Cambiar `--accent` por pestaña (hoy `body[data-tab=…]` en `tablero.css`). El acento es uno solo en toda la app.
- Cuadrículas de tarjetas idénticas (icono en cuadrito de color + etiqueta + palabra gigante), y tarjetas dentro de tarjetas. La estructura sale del espacio y del ritmo, no de cajas.
- Encerrar cada fila de una lista en su propia tarjeta con sombra. Las listas son filas con divisores de 1px.
- El mismo radio grande para todo. Radios de 20px o más en piezas pequeñas.
- Sombras genéricas en tarjetas (`0 4px 14px …`). En oscuro, cero sombras: la altura se da por brillo.
- Estados vacíos que gritan: «0%», «Ninguna», «Sin rutina» en letra de titular. Ceros grandes en general.
- Curvas con rebote (`cubic-bezier(.3,1.6,.6,1)` o cualquier valor > 1). Nada se pasa de su marca.
- Animar `width`, `height`, `top`, `bottom`, `left`, `margin` o `padding`. Solo `transform` y `opacity`.
- `backdrop-filter: blur()` en elementos que se quedan en pantalla (cabecera, barra inferior): cuesta batería y da tirones en Android.
- `:hover` suelto: en el celular se queda pegado. Siempre dentro de `@media (hover: hover) and (pointer: fine)`.
- Tamaños de letra fuera de la escala, letra menor de 12px, campos de texto menores de 16px (el celular hace zoom).
- Dos botones que hacen lo mismo en la misma pantalla (hoy «+» del formulario y «Anotar»).
- Textos de plantilla o de robot: «¡Comienza ahora!», «Potencia tu productividad», explicaciones de más, exclamaciones, emojis decorativos. Español de Colombia, directo, en segunda persona («tú»).
- Iconos emoji en la interfaz (se usan SVG de trazo, `stroke-width: 2`, `currentColor`).
- Fuentes nuevas descargadas de internet. Solo Manrope local (`fonts/manrope.woff2`).

## 2. Tokens

Todos en `:root` de `tablero.css` (claro, oscuro por `prefers-color-scheme` con `:root:not([data-theme="light"])`, y `:root[data-theme="dark"]`). Nunca valores sueltos en las reglas.

### Tipografía
- Familia única: `--font-sans: "Manrope", system-ui, sans-serif`. Excepciones con función: `--font-mono` (`ui-monospace…`) solo para el código de sincronización; `--font-serif` (`Georgia…`) solo para leer un resumen terminado.
- Escala (no hay más tamaños):
  | Token | Valor | Uso | Peso |
  |---|---|---|---|
  | `--text-xs` | 0.75rem (12px) | etiquetas, barra inferior, contadores, fechas | 600 |
  | `--text-sm` | 0.875rem (14px) | metadatos, chips, estados vacíos, ayudas | 500 |
  | `--text-base` | 1rem (16px) | tareas, botones, todo campo editable | 500 (600 en botones) |
  | `--text-lg` | 1.125rem (18px) | títulos de tarjeta, libros, hojas | 700 |
  | `--text-xl` | 1.5rem (24px) | título de pantalla, cifra principal | 800, `letter-spacing: -0.02em` |
- Interlineado: 1.25 en títulos, 1.45 en texto, 1.6 en lectura larga.
- Etiquetas en mayúsculas: `--text-xs`, `letter-spacing: 0.06em`, `--muted`. Con moderación (una por bloque).
- Números (fechas, montos, porcentajes, contadores): `font-variant-numeric: tabular-nums`. Quitar `font-feature-settings: "tnum" 0`.

### Color (regla 60/30/10)
- 60 % `--bg`, 30 % `--surface`/`--surface-2`, **10 % `--accent`**.
- `--accent` solo en: acción principal de la pantalla («Anotar»), pestaña activa, foco de campo, casilla marcada. Nada más.
- Colores semánticos solo con significado: `--high`/`--danger` = urgente o vencido, `--medium` = prioridad media, `--low` = hecho/bien. El tono de `--high` debe distinguirse claramente de `--accent`.
- Los tonos de área (`--grn`, `--amb`, `--ros`, `--ind`) quedan para detalles pequeños (punto, icono de 16px, portada de libro), nunca para botones ni para la pestaña activa.
- Texto: `--text` para leer, `--muted` para secundario (≥ 4.5:1), `--faint` solo para desactivado o decorativo (no para texto que haya que leer).
- Todo par texto/fondo cumple WCAG AA (4.5:1; 3:1 en texto ≥ 24px o iconos).

### Superficies, bordes y elevación
- Borde estándar: `1px solid var(--border)`. Divisores de lista: `border-top: 1px solid var(--border)` entre filas, sin caja alrededor de cada una.
- Claro: `--shadow: none` en tarjetas; `--shadow-float` solo en lo que flota (botón Anotar, hojas, avisos).
- Oscuro: elevación por brillo en 3 escalones (`--bg` < `--surface` < `--surface-2`) + borde `rgba(255,255,255,.08)`; sin sombras salvo `--shadow-float`.
- Cabecera y barra inferior: fondo sólido (`--bg` o `--surface`) con borde de 1px, sin desenfoque.

### Geometría
- Radios: `--radius-sm` 8px (chips cuadrados, celdas, iconos), `--radius-md` 12px (botones, campos, filas), `--radius-lg` 16px (tarjetas y bordes superiores de hojas), `--radius-pill` 9999px (chips, casillas redondas). Un radio interior = radio exterior − padding.
- Espaciado en múltiplos de 4px: 4, 8, 12, 16, 24, 32, 48. Margen lateral de pantalla: 16px. Entre secciones: 24–32px. Dentro de una fila: 12px vertical, 16px horizontal.
- Objetivos táctiles ≥ 44×44px (ideal 48). Selector de fecha ≥ 7.5rem de ancho.
- Ancho de contenido en computador: 640px (una columna) salvo el diseño de ≥1024px ya existente.

## 3. Componentes

- **Botón primario:** `--accent`, `--on-accent`, `--radius-md`, alto 48px, `--text-base` 600. Uno por pantalla.
- **Botón secundario:** `--surface-2`, texto `--text`, sin borde. **Terciario:** solo texto `--accent` o `--muted`.
- **Botón de icono:** 44×44, icono 22px `--muted`; activo `--text`.
- **Fila de tarea:** casilla redonda 22px a la izquierda, texto `--text-base`, meta (`fecha · prioridad`) en `--text-sm --muted`; prioridad como punto de 8px o borde izquierdo de 3px, no como fondo de color. Vencida: la fecha en `--high`, no toda la fila.
- **Estado vacío:** una línea en `--text-sm --muted` + una acción de texto. Ejemplo: «Nada pendiente para hoy. · Anotar algo». Sin ilustraciones, sin ceros grandes.
- **Botón que trabaja:** al tocarlo se desactiva y cambia su texto («Sincronizando…», «Conectando…», «Guardando…»); vuelve al terminar o muestra el error en una línea.
- **Hojas (`.sheet`):** suben desde abajo, `--radius-lg` arriba, asa de 36×4px, título `--text-lg`.
- **Barra inferior:** 5 destinos, icono 24px + etiqueta `--text-xs`; activo = icono y texto en `--accent` con un indicador pequeño; inactivos `--muted`.
- **Cabecera:** título de pantalla `--text-xl` a la izquierda; máximo 3 iconos a la derecha, cada uno con `aria-label`.

## 4. Movimiento

- Curvas: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` (entradas, hojas, barras); `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)` (cambios de estado). No hay otras.
- Duraciones: `--dur-fast` 140ms (toque, casilla), `--dur-base` 220ms (avisos, pestañas, color), `--dur-slow` 300ms (abrir/cerrar hojas). Salir es más rápido que entrar (≈ 0.75×).
- Solo `transform` y `opacity`. Barras de progreso con `transform: scaleX()` y `transform-origin: left`.
- Toque: `:active { transform: scale(0.98) }` en botones; casilla marcada: `scale(0.9 → 1)` en 140ms, sin rebote.
- Entradas: `opacity 0→1` + `translateY(8px→0)`; listas en escalón de 30ms como máximo, y solo para los primeros 6 elementos.
- Nada en bucle infinito salvo un indicador de carga mientras de verdad se espera.
- `@media (prefers-reduced-motion: reduce)` apaga `transition` **y** `animation`.

## 5. Accesibilidad y celular

- `:focus-visible` con `outline: 2px solid var(--accent); outline-offset: 2px`.
- Contraste AA en claro y oscuro; probar ambos temas.
- `env(safe-area-inset-*)` en cabecera, barra inferior y hojas.
- Iconos solos siempre con `aria-label` en español.
- Nada depende solo del color (prioridad: punto + texto en el menú; vencida: color + palabra «vencida»).

## 6. Revisión final (antes de commit)

Responde sí/no a cada una; si alguna es «no», corrige:
- ¿Hay un solo acento visible y es la acción principal?
- ¿Las tareas del día se ven sin scroll en 390×844?
- ¿Todos los tamaños, radios, duraciones y colores salen de los tokens?
- ¿Se ve bien en oscuro sin sombras?
- ¿Algún texto suena a plantilla o a robot?
- ¿Algo anima propiedades de layout o rebota?
- ¿Pasan `npm run unit` y `npm run e2e`?
