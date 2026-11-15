# Análisis de los 10 videos de diseño (Fase 1)

**Método de trabajo:** Primero, Gemini Web (Gemini Pro) vio cada uno de los 10 videos aplicando una guía de 5 puntos (composición, superficies/color/letra, movimiento, errores típicos de IA y reglas CSS). Después, Claude comprobó los títulos reales de los 10 videos (vía oEmbed de YouTube) y, en el video 1, contrastó los tiempos y datos contra los subtítulos; a continuación, Gemini (Antigravity) hizo el filtro crítico frente al código real de la aplicación («Pendientes y Resúmenes») y Claude auditó el resultado. **Aviso importante:** todos los datos marcados como `[estimado]` son lecturas visuales de la pantalla (colores, tamaños o tiempos aproximados que el autor del video no dijo en voz alta). Los valores creados específicamente para mejorar nuestra app se marcan como `[propuesta]`.

---

## 1. Sitios web increíbles en 2026: Claude Design lo hace posible — Nexum AI
Enlace: https://www.youtube.com/watch?v=NvAtpFOOvow
*(Verificado por Claude contra subtítulos: espacio blanco a la izquierda del hero en 05:01, video de 8 s en bucle en 06:04, "mini fade" en la transición en 08:26 y 09:47. Fuentes y colores = estimados de Gemini).*

1. **Composición:** Deja un espacio en blanco intencional en el tercio izquierdo de la portada (*hero*) para que el texto se lea limpio sin pisar al personaje (05:01). La tabla de precios usa 3 columnas donde la tarjeta central ("Deluxe") destaca por ser más grande y tener marco (14:10) `[estimado]`. La sección de juego (*gameplay*) muestra una cuadrícula compacta de 2×4 con iconos mínimos (13:55) `[estimado]`. No habla de jerarquía sin cajas repetidas.
2. **Superficies, color y letra:** En los prompts en pantalla (11:44) combina una letra condensada de impacto para títulos (Teko/Oswald) y una letra sin remates neutra para el texto general (Inter/Roboto) `[estimado]`. El título principal va en mayúsculas con grosor muy alto, peso `800–900` (09:37) `[estimado]`. Usa un color de acento magenta muy vivo (`~#d900ff`) reservado casi exclusivamente para el botón principal "PLAY FREE NOW" y detalles puntuales (09:37, 14:04) `[estimado]`. Las tarjetas son oscuras con un borde fino de `1px` `rgba(255,255,255,.1)` y sin sombras pesadas (13:55) `[estimado]`. No menciona elevación por luminosidad.
3. **Movimiento:** Usa un video de fondo de 8 s en bucle (06:04) con un fundido suave (*crossfade* / "mini fade") para disimular el corte cuando vuelve a empezar (08:26, 09:47). No define curvas de animación, rebotes ni efectos al pasar el ratón; los botones ni siquiera tienen estado de interacción (14:18).
4. **Anti-patrones (errores que critica):** Critica intentar construir toda una página en una sola instrucción gigante ("querer hacerlo todo en un prompt... lo hubiese hecho muy mal", 15:08) y recomienda trabajar paso a paso por secciones o componentes.
5. **CSS extraído del video:**
   ```css
   background-color: #09090b;
   color: #fafafa;
   font-family: 'Inter', sans-serif;
   border: 1px solid rgba(255, 255, 255, .1);
   accent-color: #d900ff;
   transition: background-color .2s ease-in-out;
   ```

---

## 2. Crea una Página Web ANIMADA con IA que no se ve hecha con IA — Ruva
Enlace: https://www.youtube.com/watch?v=qlhT4J8PT-s

1. **Composición:** Usa márgenes internos (*padding*) amplios para alejar el texto de los bordes (15:20) `[estimado]`. Encabezado dividido en dos: título a la izquierda y foto recortada a la derecha (15:18) `[estimado]`. Densidad moderada organizada en bloques cortos a partir de una tabla de estructura armada previamente en Claude (14:25). En vez de repetir cajas iguales, separa las secciones alternando el color de fondo en franjas horizontales (blanco, azul oscuro, celeste) (13:24).
2. **Superficies, color y letra:** Fondo azul marino `#0E1F3B`; el color naranja `#F7931E` se guarda solo para los botones de acción, tachones y la cruz (12:28, 13:05). Tarjetas blancas sobre fondo celeste `#D8ECFB`, sin sombras duras, separadas por diferencia de brillo y bordes finos (13:06) `[estimado]`. Define explícitamente "una sola letra: Poppins" para toda la web (13:07). Títulos con peso `~700` y tamaño `~2.5rem`; párrafos con peso `400`, tamaño `1rem` y altura de línea (*line-height*) de `1.5` (13:08) `[estimado]`.
3. **Movimiento:** Los elementos van apareciendo de forma escalonada a medida que bajas por cada sección (09:43, 15:24), con entradas suaves de `~400–600 ms` usando desaceleración `ease-out` (15:25) `[estimado]`. Respuesta rápida al pasar el cursor y al abrir los acordeones de preguntas frecuentes (15:30) `[estimado]`.
4. **Anti-patrones (errores que critica):** Critica abrir ChatGPT o Claude y pedir "hazme una página para mi negocio con muchas animaciones" sin entregar antes un sistema de diseño claro (00:58). Explica que pedir algo "bonito" es ambiguo y que hay que dar referencias visuales concretas (03:20).
5. **CSS extraído del video:**
   ```css
   background: #0E1F3B;
   /* Tarjeta: */
   background: #FFF;
   border: 1px solid #D8ECFB;
   font-family: 'Poppins', sans-serif;
   /* Botón de agregar: */
   background: #F7931E;
   ```

---

## 3. How to Build $10K Websites in Minutes (Claude AI) — Metics Media
Enlace: https://www.youtube.com/watch?v=snErQUyqwCU

1. **Composición:** En voz no menciona espacio vacío, cuadrículas ni densidad. Visualmente destaca por usar muchísimo espacio libre y una composición centrada y minimalista (00:23–00:27, 00:30–00:36) `[estimado]`. La importancia de cada elemento la marca el tamaño de la letra, no el uso de cajas repetidas (00:28, 00:36, 00:41).
2. **Superficies, color y letra:** No habla de bordes de `1px`, elevación ni color de acento. Usa fondos oscuros para que resalten el producto y el texto blanco (00:23–00:27) `[estimado]`. Combina una letra con remates (*serif*) grande en el título con una letra sin remates (*sans*) o más pequeña en el resto (00:28). En el ajuste pide poner la fuente "más negrita" (17:41, 18:16–18:30), sin dar números exactos.
3. **Movimiento:** No menciona tiempos en milisegundos ni curvas. Busca que "toda la página se mueva contigo" al bajar con la rueda o el dedo, contando una historia (00:15–00:19). Muestra videos generados con IA cuyo avance está atado al desplazamiento de la página (café cayendo en 00:24; gota que se transforma en botella en 00:33; también en 06:48, 11:54 y 15:53). Incluye un botón de "mantener presionado" (*Hold the button*) que llena una barra de progreso mientras lo sostienes (16:32–16:37).
4. **Anti-patrones (errores que critica):** Asegura que estos sitios no tardan en cargar, no se sienten lentos y funcionan bien en el celular (00:58–01:03). No menciona vicios típicos de IA.
5. **CSS extraído del video:** El video no da ninguna regla técnica (Gemini había sugerido valores genéricos como `flex column`, `padding: 1rem` y fondo `#FAFAFA`, que no aportan valor).

---

## 4. Build $10,000 Websites using Claude Code (Ultimate Guide) — Metics Media
Enlace: https://www.youtube.com/watch?v=VMvZuhcDdnw

1. **Composición:** Presenta un menú sin cajas donde el orden visual lo dan cambios drásticos de tamaño (nombre de ciudad gigante, dirección mediana, descripción pequeña) (10:09–10:26). En su instrucción de revisión exige que "los espacios en blanco respiren" y que exista una lectura clara en tres niveles: primario, secundario y terciario (16:30). Muestra un panel de texto en 3 columnas asimétricas para computador (18:19) `[estimado]`. Muy poca densidad de texto, usando frases cortas como *"Six dishes. One fire"* (10:26).
2. **Superficies, color y letra:** Prohibido usar colores "arcoíris" (10:03); fija una paleta estricta de 5 tonos (09:56): casi negro (`#0A0908`), crema cálido (`#E9E5DE`), rojo sangre de toro (`#5C231F`), latón (`#B89966`) y gris pizarra (`#393E46`) `[hex estimados]`. Separa las secciones con líneas finas color latón (*brass hairlines*) animadas (17:30) de `~1px` `[estimado]`. Da sensación de profundidad poniendo textura de grano de película sobre el fondo oscuro en lugar de usar sombras o tarjetas elevadas (17:27). Empieza con Fraunces para títulos e Inter para texto (09:44), pero luego reemplaza Inter por Geist (20:45). Títulos gigantes de `6–8rem` con grosor fino `300–400` `[estimado]`; etiquetas pequeñas en versalitas con separación entre letras (*tracking*) de `~0.1em` (09:51) `[estimado]`.
3. **Movimiento:** No dice números exactos en voz. La portada se mueve 1:1 con el avance del scroll (15:28) `[estimado]`. Hay brasas flotantes con efecto de profundidad (*parallax*) que siguen el puntero del ratón (18:45–18:55) y un halo de luz que persigue al cursor con un pequeño retraso o inercia de `~300 ms` (19:08–19:22) `[estimado]`. Los títulos van apareciendo palabra por palabra (17:35).
4. **Anti-patrones (errores que critica):** Dice que la fuente Inter "grita que una IA hizo esto" (20:35–20:42). Critica los textos redactados por IA que explican de más y abusan de los adjetivos (20:00–20:05). Critica tratar la vista de celular como un "escritorio encogido" en vez de decidir qué ocultar y qué compactar (20:53–21:05). También rechaza partir de plantillas prefabricadas porque hacen que todo se vea igual (01:37).
5. **CSS extraído del video:**
   ```css
   background: #0A0908;
   color: #E9E5DE;
   font-family: 'Geist', sans-serif;
   border-bottom: 1px solid #B89966;
   transition: transform .4s cubic-bezier(0.16, 1, 0.3, 1);
   ```

---

## 5. Claude Design Now Builds Beautiful $10,000 Websites (NO AI Slop) — Jack Roberts
Enlace: https://www.youtube.com/watch?v=VwGrXe2ricE
*(Nota de verificación: casi todos los números de este video son `[estimado]`; los datos textuales confirmados en el video son la lista de clichés de IA en 00:53–01:28, la regla "One ask per screen" en 18:55–19:08 y las fuentes recomendadas en 14:35–14:41).*

1. **Composición:** Deja espacios verticales enormes entre secciones (`~80–120px`) tomando como referencia sitios como Mercury o Linear (01:54) `[estimado]`. Alinea el texto a la izquierda (ocupando 6–8 columnas) con elementos gráficos flotando a la derecha en los ejemplos Slush (04:10) y Neuro (05:58) `[estimado]`. Sobre la cantidad de cosas en pantalla, repite tres reglas clave: *"One ask per screen"* (una sola petición por pantalla), *"one page one thought"* (una página, una idea) y *"Don't make me think"* (no me hagas pensar) (18:55–19:08). Critica las tarjetas idénticas (01:16) y arma la jerarquía con letra grande sobre fondo despejado (06:01) `[estimado]`.
2. **Superficies, color y letra:** Texto casi negro (`~#111`) sobre fondo blanco o gris muy claro `#FAFAFA` (05:50) `[estimado]`. Campos de texto con borde sutil de `1px` `rgba(0,0,0,.06)` (06:10) `[estimado]` y sombras sumamente suaves `0 15px 35px rgba(0,0,0,.04)` `[estimado]`. Sugiere cinco fuentes con personalidad: Satoshi, Bricolage Grotesque, Cabinet Grotesk, Clash Display y Panchang (14:35–14:41). Títulos de portada en peso `800` a `3.5–4rem`, altura de línea `1.1` y letras juntas con `tracking: -0.03em` `[estimado]`. Color de acento "azul eléctrico" (`~#0055FF` `[estimado]`, 05:27) usado casi únicamente en el botón principal y en los avatares (05:50).
3. **Movimiento:** No dicta tiempos ni curvas. Elogia las animaciones al bajar por la página y las capturas de aplicación que se salen hacia el borde de la pantalla en Slush (04:17). Los bloques entran subiendo suavemente (`translateY(20px)` + opacidad) `[estimado]` y hay gráficos moviéndose en bucle continuo (10:04).
4. **Anti-patrones ("AI Slop Monster"):** Enumera los sellos típicos de una web genérica hecha con IA: usar siempre Inter, Poppins o Space Grotesk (00:53); el degradado índigo a violeta (01:08); poner siempre tres tarjetas iguales en fila (*"three feature cards, always three"*, 01:16); usar el mismo redondeo de esquinas en todo (01:21); poner paneles de vidrio borroso sobre una mancha de color difuminada (01:23); y usar títulos vacíos con redacción robótica (01:25–01:28).
5. **CSS extraído del video:**
   ```css
   font-family: 'Satoshi', sans-serif;
   --accent: #0055FF;
   background: #FAFAFA;
   color: #111;
   border: 1px solid rgba(0, 0, 0, .06);
   border-radius: 12px;
   box-shadow: 0 8px 24px rgba(0, 0, 0, .03);
   /* Título: */
   font-weight: 800;
   letter-spacing: -0.02em;
   line-height: 1.15;
   /* Botón píldora (ojo: esta curva tiene rebote > 1 y se descarta más adelante): */
   transition: transform .2s cubic-bezier(0.25, 1.2, 0.5, 1);
   ```

---

## 6. Insane Claude Design Skills You Need To Actually Build Beautiful Sites — AI LABS
Enlace: https://www.youtube.com/watch?v=Ysr7oNDajJI

1. **Composición:** Muestra la interfaz "Margin", donde el orden visual nace únicamente de la diferencia de tamaño entre textos y del espacio libre, sin encerrar nada en cajas (00:07) `[estimado]`. En la página "Solenne", coloca una foto arriba a la derecha contra un título enorme, evitando centrar todo (08:40) `[estimado]`. Incluye un validador automático que detecta un error real de móvil: un selector de fecha que mide `99px` de ancho en pantallas pequeñas se corta, y exige al menos **`113px`** para verse completo (09:58). No da reglas de columnas.
2. **Superficies, color y letra:** En el ejemplo "Layer by Layer", usa verde lima únicamente en botones y contadores sobre un fondo casi negro (00:20) `[estimado]`. En "Understory", separa las tarjetas solo con líneas finas de `1px`, sin sombras ni parches de color (06:38) `[estimado]`. En "Tastemaker" enseña variables exactas en pantalla (10:39): fondo `page #F6F1E9`, texto `ink #23262B`, acento `accent #E08A3C`, redondeo `radius 14px` y separación `gap 32px`. En "Michi" contrasta un título gigante con remates (*serif*) frente a números muy pequeños sin remates (11:14) `[estimado]`. No especifica interlineado, separación de letras, grosores ni elevación.
3. **Movimiento:** Muestra animaciones atadas al avance del scroll (02:54). Destaca un detalle práctico muy útil: al tocar el botón de reserva, su texto cambia en el acto a *"Checking the book..."* mientras procesa la acción (03:32). Y fija una regla de rendimiento escrita en pantalla (12:25): **"Transform + opacity only — never animate layout properties (that's where the lag comes from)"** (animar únicamente `transform` y `opacity`; jamás animar propiedades de tamaño o posición como `width`, `height`, `top` o `bottom`, porque ahí es donde aparecen los tirones). No da milisegundos ni curvas.
4. **Anti-patrones (errores que critica):** Critica conformarse con los valores por defecto de la IA (*"AI-slop defaults"*, 00:10, 10:18), dejar fondos planos sin gracia cuando el diseño pide ambiente (12:23), repartir colores tímidos sin un protagonista claro o caer en el degradado morado sobre blanco (12:23). Lista de fuentes prohibidas en su guía: Inter, Roboto, Arial, las fuentes del sistema (*system font stack*) y Space Grotesk (12:23).
5. **CSS extraído del video:**
   ```css
   background: #F6F1E9;
   color: #23262B;
   --accent: #E08A3C;
   border-radius: 14px;
   gap: 32px;
   transition: transform .2s ease, opacity .2s ease;
   ```

---

## 7. Turn Claude Into A Design GENIUS In 3 Simple Steps — Chase AI
Enlace: https://www.youtube.com/watch?v=7FU98O0JLHs
*(Nota de verificación: en la primera lectura hubo dudas entre valores visuales como H1 de 42px vs 62px o tracking -0.04 vs -0.05em. Lo 100 % confirmado en pantalla son las frases textuales de la guía en 05:20–05:29 y el panel de ajustes en 21:13: fuente Hanken Grotesk, H1 con peso 500 y H2 de 27px).*

1. **Composición:** Regla textual en pantalla (05:21): **"Structure from spacing and rhythm, not a grid of identical cards nested in more cards"** (dar estructura mediante el espacio y el ritmo, no con una cuadrícula de tarjetas idénticas metidas dentro de más tarjetas). Muestra el estilo "Vast quiet" (muy vertical y despejado, 14:45), "Ledger" (contenido a la izquierda con un índice fijo que acompaña la lectura al bajar, 16:15) y "Frames" (márgenes laterales que enmarcan cada bloque, 16:25). El paso de la portada al contenido se hace con un desvanecido suave en lugar de un corte brusco (19:26).
2. **Superficies, color y letra:** Reglas textuales en pantalla (05:20): **"a type scale with real contrast, set in a face chosen on purpose, not Inter by default"** (una escala de tamaños de letra con contraste real, usando una fuente elegida a propósito, no Inter por costumbre) y **"Palettes that clear WCAG and commit to a hue. The purple-gradient default never ships"** (paletas de color que cumplan el estándar de legibilidad WCAG y se comprometan con un tono claro; el degradado morado por defecto jamás sale a producción). En el panel de ajustes (21:13) usa Hanken Grotesk tanto para títulos como para texto general; título `H1` con peso `500`, tamaño `62px` y `tracking: -0.05em` `[estimado]`; subtítulo `H2` de `27px`; texto general de `18px` `[estimado]`. En colores (21:58), combina grises oscuros con un único color de acento cálido naranja/ámbar `[estimado]`. También muestra el estilo "dither mono" en blanco y negro con textura punteada (14:52).
3. **Movimiento:** Regla de oro textual en pantalla (05:29): **"Motion that eases like physics and settles. Nothing bounces or springs past its mark"** (movimiento que frena con suavidad física y se asienta en su sitio; **nada rebota ni se pasa de la raya**). Pide que los botones parezcan claramente pulsables (05:29). En la carga, los elementos entran con aplomo uno tras otro (19:14, 19:20) y la portada se funde suavemente con el cuerpo (19:26).
4. **Anti-patrones (errores que critica):** Rechaza las páginas genéricas llenas de Inter y degradados azul-morado (00:09–00:15), las fotos de banco de imágenes sin gracia y las "burbujas 3D" decorativas (*3D SaaS blobs*, 14:07–14:08), las cuadrículas de tarjetas idénticas anidadas (05:21) y las animaciones con efecto resorte que rebotan al llegar (05:29).
5. **CSS extraído del video:**
   ```css
   font-family: 'Hanken Grotesk', sans-serif;
   /* Títulos: */
   font-weight: 500;
   letter-spacing: -0.05em;
   /* Lista: */
   gap: 24px;
   padding: 16px 20px;
   transition: transform .4s cubic-bezier(0.25, 1, 0.5, 1), opacity .4s ease;
   /* Al presionar: */
   :active { transform: scale(.98); }
   --accent: #FF5A00; /* [estimado] */
   ```

---

## 8. Claude Design Just Solved its #1 Problem... I Quit — Jack Roberts
Enlace: https://www.youtube.com/watch?v=cM5n9priMjo

1. **Composición:** Propone usar proporciones en lugar de números sueltos (*"Ratios, not numbers"*), escalando los espacios con la proporción áurea `1.61` (07:53). Pide igualar la altura de los bloques en columnas enfrentadas para que la cuadrícula quede alineada (06:57). Muestra una portada asimétrica con objetos 3D flotando en el sitio "neuro" (11:42). En sus reglas de control exige respetar el diseño base: si la referencia no va centrada, prohibido centrar (*"nothing centred"*), y usar estructuras con nombre propio (*"named layouts"*, 08:02–08:04). No habla de densidad ni de cajas repetidas.
2. **Superficies, color y letra:** Aplica la **regla 60/30/10** para repartir el color: 60 % color de fondo dominante, 30 % color secundario de estructura y solo **10 % color de acento** (07:58). Vigila que ningún texto se salga de su altura de línea (06:46). En el sitio "neuro" combina Bricolage Grotesque gruesa para títulos con Plus Jakarta Sans para el cuerpo (12:31–13:24) `[estimado]`. No da medidas en píxeles, códigos hexadecimales, sombras ni bordes de `1px`.
3. **Movimiento:** Inserta gráficos animados tipo documental de Vox de exactamente 10 s (15:55), bloques que entran desde los lados (15:21), hojas cayendo sin parar en el fondo (19:02) e ilustraciones que flotan al mover la página (11:51). No define curvas ni estados para los botones.
4. **Anti-patrones (errores que critica):** Define la "basura de IA" (*AI slop*) como diseños que pueden verse llamativos sueltos pero son aleatorios e inconsistentes porque no siguen un "ADN" o sistema de reglas fijo (01:11–01:30). Critica poner demasiado texto (14:37) y que suene redactado por máquina (14:41). Rechaza los botones con frases clichés como *"Get started"* o *"Start free"* (14:11) y los títulos sosos (*"The fun way to learn AI"*) frente a frases directas y con verdad (*"Everyone uses AI. Almost nobody is good at it"*, 14:16).
5. **CSS extraído del video:**
   ```css
   padding: 1.61rem;
   line-height: 1.61;
   font-family: 'Bricolage Grotesque', sans-serif;
   /* Regla 60/30/10: fondo = 60%, superficie = 30%, acento = 10% (solo en casilla marcada y botón flotante) */
   ```

---

## 9. Claude Design 3.0 fundamentos en 30 minutos — Lorena Bordonaba (Inteligencia Artificial)
Enlace: https://www.youtube.com/watch?v=kXI4hCuwTU0
*(Nota de verificación: este video trata sobre todo de diseño gráfico, carteles y logotipos animados; los números de interfaz salen de un muestrario o "UI kit" que aparece entre el minuto 21:50 y el 21:57).*

1. **Composición:** Deja mucho aire alrededor de las tarjetas y fondos despejados en las animaciones (06:27, 10:48) `[estimado]`. Muestra un cartel donde un bloque naranja ocupa dos tercios de la imagen para romper la simetría (07:51) y una cuadrícula de categorías en tarjetas negras de 3 columnas por 2 filas (07:54). No habla de jerarquía sin cajas.
2. **Superficies, color y letra:** En el muestrario (21:54) usa un "panel color hueso" `#F4F2F0` con texto oscuro apoyado sobre fondos negros `#000` y `#111`. No menciona bordes de `1px`. Usa la fuente Inter en grosor fino (`300`) para títulos gigantes de `64–96px` con letras apretadas (*tracking* negativo, 21:54). Combina un acento rojo `#C8321A` (para pastillas y esferas) y un naranja `#F84B1E` / `#FF4A1C` para marcar lo que se mueve o tiene la atención (21:54, 21:57). Define contenedores muy redondeados con radio de `28px`, barras superiores de `58px` de alto y paneles de `520px` con texto de `26px` (21:50–21:54).
3. **Movimiento:** Anima un logotipo dictando los segundos exactos: una esfera cae de `0` a `1.6 s`, rebota hasta su punto más alto en `2.7 s`, vuelve a caer en `3.5 s` y el logo queda fijo de `3.5` a `5 s` (10:04–10:14), acelerando al bajar y frenando al subir (10:12). También muestra interruptores estilo iPhone (*toggles* iOS) en un aviso de cookies (21:15) `[estimado]`. No enseña transiciones para una aplicación de tareas.
4. **Anti-patrones (errores que critica):** Critica los paneles y plantillas repetidos que "no paras de ver por todos los sitios" por culpa de instrucciones vagas sin intención (00:23, 08:51). Advierte que si le pides al código que dibuje ilustraciones complejas sin darle fotos ni herramientas gráficas, dibuja "un muñequito de palos" (11:42).
5. **CSS extraído del video:**
   ```css
   /* Lienzo: #000, marco: #111, panel: #F4F2F0 */
   font-family: 'Inter', sans-serif;
   border-radius: 28px;
   padding: 1.5rem;
   /* Título: */
   font-weight: 300;
   font-size: 26px;
   letter-spacing: -0.02em;
   /* Punto de prioridad: 12px color #C8321A */
   ```

---

## 10. Claude Code Ahora Diseña Webs PROFESIONALES (Tutorial Hallmark) — Pau Berenguer
Enlace: https://www.youtube.com/watch?v=A3b7Hk3eV94

1. **Composición:** Critica el esquema trillado de poner un bloque arriba seguido de tres cajas iguales en fila (01:07) y la fórmula repetitiva de "título, descripción de tres líneas y dos botones" (16:45). Pide expresamente "mucho espacio negativo" (19:53). Su resultado final ("Umbral") es asimétrico, con el texto a la izquierda, imagen flotando y sin encerrar las cosas en cajas (22:06), prescindiendo de la cuadrícula clásica de columnas (22:36).
2. **Superficies, color y letra:** Rechaza los degradados violeta y rosa de siempre (01:10) y escoge un tema oscuro llamado "Dusk" (15:05). Durante la revisión automática detecta otro cliché de moda: el "neobrutalismo claro" con borde negro grueso (`~2px` `[estimado]`), sombra dura desplazada y esquinas redondas (26:30). También corrige la manía de repetir en cada sección un subtítulo `h2` acompañado de una línea gris debajo (26:35). Para dar sensación de altura en modo oscuro, coloca los paneles "por encima" usando un borde fino de `~1px` `rgba(255,255,255,.1)` y una sombra suave de `~0 8px 24px rgba(0,0,0,.15)` (29:38) `[estimado]`. Usa una base sobria en azul muy oscuro o negro con un color de acento moderado (`#111` y `#3B82F6` `[estimado]`, 30:05). No menciona tamaños ni grosores de letra.
3. **Movimiento:** Pone un degradado de fondo que se desplaza muy despacio (17:15; ciclo continuo de `~10–15 s` `[estimado]`), una animación por pasos que describe como "natural, sin cambio brusco" (`~300–400 ms ease-in-out` `[estimado]`, 17:35) y un cambio suave en los bordes y fondos de las tarjetas al pasar el cursor (`~200 ms` `[estimado]`, 29:50).
4. **Anti-patrones (errores que critica):** Señala cinco vicios típicos de IA: poner un título gigante con una sola palabra pintada de color o degradado (01:12); meter absolutamente todo dentro de tarjetas redondeadas (01:14); dividir siempre la portada con texto a la izquierda y foto a la derecha (26:28); las listas de pasos 1 a 4 con números gigantes (26:36); y la fila de cuatro beneficios idénticos sobre fondo negro (26:37).
5. **CSS extraído del video:**
   ```css
   border: 1px solid rgba(255, 255, 255, .08);
   box-shadow: 0 4px 16px rgba(0, 0, 0, .12); /* para tarea activa */
   background: linear-gradient(145deg, #1A1A1A, #111);
   /* Títulos: */
   letter-spacing: -0.02em;
   transition: transform .25s cubic-bezier(0.2, 0.8, 0.2, 1);
   ```

---

## Tabla de síntesis

| Qué se extrajo (de los 10 videos) | Qué se descartó (ruido/hype) y por qué | Qué se queda como regla de oro (para nuestra app) |
| :--- | :--- | :--- |
| **1. Estructura y espacio (Layout):** Jerarquía mediante el tamaño de la letra y el espacio libre en lugar de meter todo en tarjetas idénticas anidadas (videos 3, 4, 5, 6, 7, 10). | Márgenes gigantes de `80–120px` (video 5), proporción áurea literal `1.61rem` (video 8) y composiciones asimétricas de cartel (videos 6, 9, 10), porque desperdician la pantalla vertical del celular. | **Menos cajas, más aire y ritmo:** en listas (Pendientes, Rutina, Ingresos) usar filas limpias o divisores de `1px` en vez de encerrar cada dato en una tarjeta con sombra. En Inicio, quitar las 4 baldosas iguales. |
| **2. Foco por pantalla (*One ask per screen*):** Cada pantalla debe tener un propósito principal claro sin duplicar controles (video 5, 18:55). | Páginas vacías con una sola frase de 3 palabras (video 4), porque una app de productividad necesita mostrar tu lista de tareas de un vistazo. | **Una sola acción de captura:** eliminar la duplicidad entre el formulario fijo de Pendientes (que hoy ocupa un tercio de la pantalla) y el botón flotante «Anotar». «Anotar» queda como puerta principal rápida. |
| **3. Familia de fuente (Tipografía):** Unificar la interfaz en una sola fuente elegida a propósito (videos 2, 7) y evitar la mezcla desordenada de tipografías por defecto (videos 4, 5, 6, 7). | Descargar fuentes nuevas de moda para carteles (Fraunces, Panchang, Clash Display, Teko) o usar Inter/Poppins/Roboto externas, porque suman peso y no aportan a una app que ya tiene su propia fuente local. | **Manrope como única fuente de interfaz:** ya vive en la carpeta `fonts/manrope.woff2`, funciona sin internet, no cuesta nada y lee perfecto en celular. Se conserva `monospace` solo para el código de sincronización y `serif` opcional dentro de la lectura larga de libros. |
| **4. Escala de tamaños de letra:** Contraste claro entre nivel primario, secundario y terciario (videos 4, 7) con `letter-spacing` ligeramente negativo en títulos grandes (videos 5, 7, 10). | Títulos de escritorio de `62–96px` con letra finita peso `300` (videos 4, 7, 9) e interlineado `1.61` en botones (video 8), porque en un teléfono parten las palabras en 4 líneas y cuestan de leer. | **Escala corta de 5 tamaños para celular** (`12px`, `14px`, `16px`, `18px` y `24px` `[propuesta]`), reduciendo los más de 20 tamaños sueltos que hoy mezclan los 4 archivos CSS, con números alineados (`tabular-nums`) en fechas y montos. |
| **5. Color y regla 60/30/10:** Repartir 60 % fondo, 30 % superficies y solo 10 % color de acento reservado para la acción principal (videos 1, 2, 5, 6, 7, 8), cumpliendo legibilidad WCAG (video 7). | El índigo/violeta por defecto (`#4f46e5`, criticado en videos 5, 6, 7 y 10), el magenta neón `#d900ff` (video 1) y teñir cada pestaña de un color distinto como un arcoíris (video 4). | **Un solo color de acento sobrio y con contraste WCAG AA** (`#b84a14` terracota en claro / `#f59e56` en oscuro, o `#0b5cab` azul cobalto en claro / `#6eb5ff` en oscuro `[propuesta]`), reservado al botón principal, «Anotar», pestaña activa y foco. |
| **6. Bordes y elevación (Modo claro y oscuro):** Separar bloques con bordes finos de `1px` y dar altura en modo oscuro aclarando levemente la superficie en vez de poner sombras negras (videos 1, 2, 5, 6, 10). | Neobrutalismo con bordes negros gruesos de `2px` y sombras duras corridas (video 10), o grano de película sobre toda la pantalla (video 4). | **Bordes de `1px` y elevación por brillo:** en claro, borde `#e4e6eb` con sombra mínima opcional solo en elementos flotantes; en oscuro, cero sombras en tarjetas (`--shadow: none`), borde `1px solid rgba(255,255,255,0.08)` y tres escalones de gris (`--bg`, `--surface`, `--surface-2`). |
| **7. Redondeo de esquinas (Radios):** No aplicar el mismo radio a todo sin criterio (video 5) ni abusar de curvas gigantes de cartel. | Radios enormes de `28px` en todas las tarjetas (video 9), porque comen espacio interior útil en pantallas angostas de celular. | **Escala corta de 3 radios según el tamaño de la pieza** `[propuesta]`: `8px` (`0.5rem`) para chips/celdas pequeñas, `12px` (`0.75rem`) para botones, campos y filas de tarea, y `16px` (`1rem`) para tarjetas grandes y hojas modales (más `9999px` en píldoras). |
| **8. Curvas y tiempos de animación:** Movimiento con física natural que frena suave y se posa en su sitio sin rebotar ni pasarse de la marca (video 7, 05:29; video 10, 17:35). | Curvas con rebote como `cubic-bezier(0.25, 1.2, 0.5, 1)` (video 5) y la actual de la app `cubic-bezier(.3, 1.6, .6, 1)` (en `tablero.css`), además de animaciones coreografiadas de 3.5 a 10 s (videos 8, 9). | **Cero rebotes:** eliminar `cubic-bezier(.3, 1.6, .6, 1)`. Dejar solo **2 curvas sin rebote** (`--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` y `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)`) y **3 duraciones fijas** (`140ms`, `220ms`, `300ms` `[propuesta]`). |
| **9. Rendimiento y fluidez:** Animar exclusivamente `transform` y `opacity`, y respetar a quien desactiva animaciones en su teléfono (video 6, 12:25). | Videos de fondo en bucle (video 1), animaciones atadas al scroll (videos 3, 4, 6), hojas cayendo (video 8), degradados móviles infinitos (video 10) y desenfoques pesados (`backdrop-filter: blur(14px)`), que gastan batería y dan tirones en Android. | **Solo `transform` + `opacity`:** cambiar las barras de progreso que hoy animan `width`/`height` y el botón «Anotar» que anima `bottom` para que usen `transform: scaleX/Y` y `translateY`. En `prefers-reduced-motion: reduce`, apagar tanto `transition` como `animation`. |
| **10. Interacción táctil (Celular vs. Computador):** Respuesta inmediata al tocar un botón (`:active { transform: scale(0.98) }`, video 7) y foco visible con teclado. | Efectos que persiguen el puntero del ratón o dependen de pasar el cursor por encima (`:hover`, videos 2, 4, 10), porque el dedo en una pantalla táctil no tiene cursor flotante. | **Toque `:active` universal y `:hover` aislado:** todo botón responde al instante al tocarlo con `:active` y `:focus-visible`. Cualquier estilo `:hover` para cuando se usa en Brave de computador se encierra en `@media (hover: hover) and (pointer: fine)`. |
| **11. Formularios y selector de fecha:** Los campos de fecha no pueden medir `99px` porque el texto se corta; necesitan mínimo **`113px`** (video 6, 09:58). | Controles nativos crudos que muestran `mm/dd/yyyy` en inglés o botones que no avisan qué está pasando cuando los tocas (video 1, 14:18). | **Selector de fecha legible y botones que informan:** mantener ancho mínimo de `120px` (`7.5rem`, superior a los `113px` del video 6) o usar chips en español («Hoy», «Mañana», «Elegir fecha»), y cambiar el texto del botón mientras procesa (ej. «Sincronizando…», video 6, 03:32). |
| **12. Estados vacíos y textos (Copia):** Textos directos, humanos y breves (videos 4, 8), evitando frases genéricas o robóticas (videos 5, 8). | Carteles gigantes que gritan lo que falta («0%», «Ninguna», «Sin rutina» en letra enorme) o botones con frases de plantilla (*"Get started"*). | **Estados vacíos tranquilos y útiles:** cuando no hay tareas, rutina u oportunidades, mostrar una sola línea discreta en tono suave (`--muted`, `0.875rem`) que invite a la acción sin ocupar media pantalla ni gritar «0%». |
| **13. Diseño móvil real (No escritorio encogido):** Pensar qué mostrar y qué compactar específicamente para la pantalla del teléfono (video 4, 20:53). | Columnas múltiples apretadas en vertical o barras superiores que se comen el espacio de lectura. | **Prioridad al contenido en el primer pantallazo:** en el celular, que al abrir Pendientes o Inicio se vean inmediatamente tus tareas del día sin tener que bajar pasando por formularios gigantes ni tarjetas decorativas. |
| **14. Método de cambios con IA:** Trabajar por bloques o componentes con un sistema de diseño fijo antes de tocar pantallas (videos 1, 2, 8). | Pedirle a la IA "ponlo más bonito" en un solo paso gigante (videos 1, 2), lo que genera estilos mezclados (como tener hoy `styles.css` pisado por `tablero.css`). | **Un solo bloque `:root` maestro y cambios por fase:** unificar primero las variables en `styles.css` y `tablero.css` antes de retocar cada pestaña por separado. |

---

## Reglas de oro

Estas 10 reglas traducen lo aprendido a instrucciones exactas para nuestra aplicación, expresadas en lenguaje claro y con sus medidas técnicas listas para usar:

1. **Una sola fuente para toda la interfaz (`Manrope`):**
   Quitamos la mezcla entre `system-ui` (en `styles.css`) y `Manrope` (en `tablero.css`). Toda la interfaz usa **Manrope** (que ya está descargada en la carpeta `fonts/manrope.woff2`, funciona sin internet y no depende de servidores externos). Además, corregimos `tablero.css` para que todos los números de porcentajes, dinero, fechas y contadores tengan el mismo ancho (`font-variant-numeric: tabular-nums`) y no bailen al cambiar. Solo el recuadro del código de sincronización conserva la letra técnica (`ui-monospace`) para distinguir bien cada letra y número.

2. **Escala corta de 5 tamaños de letra (`[propuesta]` para celular):**
   En lugar de los más de 20 tamaños distintos que hoy tiene la app, usamos únicamente 5 escalones pensados para leerse cómodo en el teléfono:
   - **Muy pequeño (`--text-xs: 0.75rem` / `12px`):** etiquetas en mayúsculas, textos de los iconos de abajo y fechas pequeñas. Prohibido usar tamaños menores a `12px` (hoy hay textos de `9.6px` y `10.4px` que cuestan leer).
   - **Secundario (`--text-sm: 0.875rem` / `14px`):** notas al pie, chips de filtro, subtítulos y avisos.
   - **Base (`--text-base: 1rem` / `16px`):** texto de las tareas, botones principales y **todos los campos donde se escribe** (tener `16px` exactos evita que el navegador del celular haga un acercamiento brusco al tocar para escribir).
   - **Subtítulo (`--text-lg: 1.125rem` / `18px`, grosor `700`):** títulos de libros, tarjetas de trabajo y encabezados de hoja.
   - **Título principal (`--text-xl: 1.5rem` / `24px`, grosor `800`, `letter-spacing: -0.02em`):** nombre de la sección arriba y cifra principal de resumen.

3. **Regla 60/30/10 y un único color de acento con lectura garantizada (WCAG AA):**
   Dejamos atrás el color morado/índigo por defecto (`#4f46e5`) que usan todas las páginas hechas con IA. El 60 % de la pantalla es el fondo tranquilo (`--bg`), el 30 % son las tarjetas o filas (`--surface` / `--surface-2`), y solo el **10 %** lleva el color de acento (`--accent`), reservado para el botón principal, «Anotar», la pestaña activa y el borde del campo donde estás escribiendo.
   - **Propuesta principal `[propuesta]` (Terracota cálido, inspirado en videos 2, 6 y 7):**
     - Tema claro: `--accent: #b84a14` (al pulsarlo: `#963b0e`) con texto blanco `#ffffff`. Tiene un contraste de **5.21:1** sobre blanco y **4.78:1** sobre el fondo `#f6f5f2` (supera el mínimo de legibilidad WCAG AA de 4.5:1).
     - Tema oscuro: `--accent: #f59e56` (al pulsarlo: `#e08338`) con texto oscuro `#141210` (contraste de **8.82:1**).
   - **Alternativa fría `[propuesta]` (Azul cobalto profundo, si prefieres tonos azules sin el morado de IA):**
     - Tema claro: `--accent: #0b5cab` (contraste **6.70:1** sobre blanco).
     - Tema oscuro: `--accent: #6eb5ff` (contraste **8.87:1** sobre `#0d0f14`).
   - **Ojo (auditoría de Claude):** la terracota `#b84a14` es casi el mismo tono que el rojo de prioridad alta `--high: #d9381e`. En una app de tareas el botón principal y la alarma de «urgente» se confundirían. Si se elige terracota, hay que mover `--high` hacia un rojo-rosado claramente distinto; con el azul cobalto ese choque no existe. La decisión queda para la Fase 3.
   - Los colores verde (`--low`), ámbar (`--medium`) y rojo (`--high` / `--danger`) quedan **únicamente** para indicar prioridades, tareas listas o vencimientos reales, no para pintar cada pestaña de un color distinto.

4. **Bordes finos de `1px` y altura por brillo en modo oscuro:**
   Las tarjetas y filas no llevan sombras oscuras pesadas. En modo claro se separan con un borde fino de `1px solid var(--border)`. En modo oscuro (`--bg: #0d0f14`), las sombras se apagan (`--shadow: none`) y la diferencia entre el fondo y una tarjeta la da un color de superficie un poco más claro (`--surface: #161922`, `--surface-2: #202532`) junto con una línea suave de `1px solid rgba(255, 255, 255, 0.08)` (videos 1, 6 y 10). Además, quitamos el desenfoque `backdrop-filter: blur(14px)` de la cabecera para que el desplazamiento en el celular sea siempre ligero.

5. **Tres medidas de redondeo (`border-radius`) según el tamaño:**
   Quitamos la mezcla actual de más de 12 redondeos distintos y dejamos tres medidas claras `[propuesta]`:
   - **Pequeño (`--radius-sm: 0.5rem` / `8px`):** cuadritos de la semana en Rutina, etiquetas internas y botones de icono pequeños.
   - **Mediano (`--radius-md: 0.75rem` / `12px`):** filas de tareas, campos de texto y botones normales.
   - **Grande (`--radius-lg: 1rem` / `16px`):** bloques principales y esquinas superiores de las hojas desplegables (`.sheet`).
   - **Píldora (`--radius-pill: 9999px`):** chips de filtro, estados de trabajo y casillas redondas de marcar.

6. **Movimiento físico sin rebotes (solo `transform` y `opacity`):**
   Eliminamos de `tablero.css` la curva con rebote `cubic-bezier(.3, 1.6, .6, 1)`. Todas las transiciones usan solo dos curvas suaves que frenan sin pasarse de largo:
   - `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` (para abrir paneles, mostrar avisos y mover barras).
   - `--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)` (para cambios cortos de color o estado).
   Y solo tres duraciones: **rápida (`140ms`)** al tocar un botón o marcar una casilla, **normal (`220ms`)** para avisos y pestañas, y **lenta (`300ms`)** para abrir o cerrar hojas desde abajo.
   Siguiendo la regla del video 6 (12:25), las barras de progreso dejan de animar `width` o `height` y pasan a usar `transform: scaleX()` / `scaleY()`, y cuando el teléfono tiene activado "reducir el movimiento" (`prefers-reduced-motion: reduce`), se apagan tanto `transition` como `animation`.

7. **Toque pensado para el dedo (`:active`) y ratón solo en computador:**
   Todo elemento tocable mide como mínimo `44×44px`, responde al instante cuando lo presionas con el dedo (`:active { transform: scale(0.98); }`) y muestra un borde claro si navegas con teclado (`:focus-visible`). Los efectos al pasar el ratón por encima (`:hover`) se activan únicamente cuando la app detecta que estás en un computador con ratón (`@media (hover: hover) and (pointer: fine)`).

8. **Estados vacíos discretos que no gritan lo que falta:**
   Cuando una lista está vacía o el día recién empieza, prohibido mostrar «0%», «Ninguna» o «Sin rutina» en tamaño gigante (`1.55rem`–`2.4rem`). En su lugar, se muestra una línea tranquila en tamaño `--text-sm` (`0.875rem`) y color suave (`--muted`), por ejemplo: *"Todo al día por hoy"* o *"Aún no hay hábitos para hoy · Agregar"*.

9. **Una sola acción de captura por pantalla y fechas en español sin recortes:**
   En Pendientes, el formulario largo deja de ocupar un tercio de la pantalla de forma permanente porque el botón flotante «Anotar» ya cumple esa función con escritura rápida («comprar pan mañana»). Cuando se muestre un selector de fecha, nunca medirá menos de **`120px` (`7.5rem`)** para superar el mínimo de `113px` detectado en el video 6 (09:58) y evitar el formato confuso `mm/dd/yyyy`, dando prioridad a los botones rápidos **«Hoy»**, **«Mañana»** y un selector claro.

10. **Botones que avisan mientras trabajan (video 6, 03:32):**
    Cuando tocas un botón que hace una operación en segundo plano (como sincronizar, conectar llamada con Claude o importar datos), el botón se desactiva momentáneamente y cambia su texto para confirmar qué está haciendo («Sincronizando…», «Conectando…», «Guardando…») en lugar de parecer que no respondió.

---

### Ejemplo completo de variables `:root` propuestas (basadas en las variables reales de la app)

Este bloque unifica en un solo lugar lo que hoy está dividido y repetido entre `styles.css` y `tablero.css`:

```css
:root,
:root[data-theme="light"] {
  color-scheme: light;

  /* 1. Tipografía única y escala corta de 5 tamaños [propuesta] */
  --font-sans: "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-serif: Georgia, "Iowan Old Style", "Times New Roman", serif;

  --text-xs: 0.75rem;     /* 12px - etiquetas, barra inferior, contadores */
  --text-sm: 0.875rem;    /* 14px - metadatos, chips, estados vacíos */
  --text-base: 1rem;      /* 16px - tareas, campos de texto (sin zoom en móvil) */
  --text-lg: 1.125rem;    /* 18px - títulos de tarjeta y subtítulos */
  --text-xl: 1.5rem;      /* 24px - título de página y cifra principal */

  /* 2. Regla 60/30/10 — Modo Claro [propuesta sobre base real] */
  --bg: #f6f5f2;          /* 60% fondo principal cálido y descansado */
  --surface: #ffffff;     /* 30% superficie de tarjetas y filas */
  --surface-2: #edece8;   /* superficie secundaria (chips, fondos de campos) */
  --track: #e4e2dd;       /* riel de barras y anillos */

  --text: #16181d;        /* contraste 16.3:1 sobre --bg */
  --muted: #575c66;       /* contraste 6.7:1 sobre --surface (pasa WCAG AA) */
  --faint: #767c87;       /* contraste 4.2:1: solo desactivados/guías, nunca texto que haya que leer */

  /* Bordes de 1px y sombra mínima solo para elementos flotantes */
  --border: #e2e0d8;
  --card-line: #e2e0d8;
  --shadow: none;
  --shadow-float: 0 8px 24px rgb(22 24 29 / 0.10);

  /* 10% Acento único con personalidad (Terracota WCAG AA: 5.18:1 sobre #fff) [propuesta] */
  /* Alternativa azul cobalto si se prefiere tono frío: --accent: #0b5cab; --accent-press: #084785; */
  --accent: #b84a14;
  --accent-press: #963b0e;
  --on-accent: #ffffff;

  /* Colores semánticos (solo para prioridades, estados y alertas reales) */
  --high: #d9381e;
  --medium: #b86b00;
  --low: #15803d;
  --danger: #c81e45;
  --on-danger: #ffffff;

  /* Matices suaves para etiquetas semánticas y bloques de resumen */
  --ind: #b84a14; --ind-mid: #d45d22; --ind-bg: #fdede3;
  --grn: #0f6e36; --grn-mid: #16a34a; --grn-bg: #e6f5ec;
  --amb: #945200; --amb-mid: #d97706; --amb-bg: #fdf2de;
  --ros: #9e2256; --ros-mid: #db2777; --ros-bg: #fce7f0;
  --fire: #b84a14; --fire-bg: #fdede3;

  --ideas-bg: #f5f2eb; --ideas-fg: #5c4b32;
  --notes-bg: #eef6f7; --notes-fg: #155e75;
  --quotes-bg: #fdf6e7; --quotes-fg: #92400e;
  --concl-bg: #eef8f1; --concl-fg: #166534;

  /* 3. Escala corta de 3 radios [propuesta] */
  --radius-sm: 0.5rem;    /* 8px  - celdas, chips cuadrados, iconos */
  --radius-md: 0.75rem;   /* 12px - botones, campos .field, filas .task-item */
  --radius-lg: 1rem;      /* 16px - tarjetas .card y hojas .sheet */
  --radius-pill: 9999px;  /* píldoras y casillas circulares */

  /* 4. Movimiento sin rebote (solo transform y opacity) [propuesta] */
  --dur-fast: 140ms;
  --dur-base: 220ms;
  --dur-slow: 300ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;

    /* Elevación por luminosidad progresiva en modo oscuro (sin sombras) */
    --bg: #0d0f14;          /* nivel 0: lienzo de fondo */
    --surface: #161922;     /* nivel 1: tarjetas y filas */
    --surface-2: #202532;   /* nivel 2: botones secundarios, campos y chips */
    --track: #262b38;

    --text: #f2f3f5;        /* contraste 17.3:1 sobre --bg */
    --muted: #9da4b3;       /* contraste 7.0:1 sobre --surface (pasa WCAG AA) */
    --faint: #6e7585;

    /* Borde sutil de 1px en lugar de sombra (videos 1, 6 y 10) */
    --border: rgba(255, 255, 255, 0.08);
    --card-line: rgba(255, 255, 255, 0.08);
    --shadow: none;
    --shadow-float: 0 8px 24px rgb(0 0 0 / 0.45);

    /* Acento cálido en oscuro (8.82:1 con --on-accent) [propuesta] */
    /* Alternativa azul cobalto en oscuro: --accent: #6eb5ff; --accent-press: #4da3ff; */
    --accent: #f59e56;
    --accent-press: #e08338;
    --on-accent: #141210;

    --high: #fb8a5c;
    --medium: #fbbf24;
    --low: #4ade80;
    --danger: #fb7185;
    --on-danger: #1a0b0f;

    --ind: #f59e56; --ind-mid: #e08338; --ind-bg: #2e1d12;
    --grn: #5be08e; --grn-mid: #22c55e; --grn-bg: #11301d;
    --amb: #fcc74f; --amb-mid: #f59e0b; --amb-bg: #33260c;
    --ros: #f7a6cb; --ros-mid: #ec4899; --ros-bg: #3a1629;
    --fire: #fda06b; --fire-bg: #3a1e10;

    --ideas-bg: #1c1a17; --ideas-fg: #e6ccb2;
    --notes-bg: #0c2730; --notes-fg: #7dd3fc;
    --quotes-bg: #2b1d0c; --quotes-fg: #fcd34d;
    --concl-bg: #0b2918; --concl-fg: #86efac;
  }
}

/* Mismo bloque para cuando el usuario elige el tema oscuro manualmente */
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0d0f14; --surface: #161922; --surface-2: #202532; --track: #262b38;
  --text: #f2f3f5; --muted: #9da4b3; --faint: #6e7585;
  --border: rgba(255, 255, 255, 0.08); --card-line: rgba(255, 255, 255, 0.08);
  --shadow: none; --shadow-float: 0 8px 24px rgb(0 0 0 / 0.45);
  --accent: #f59e56; --accent-press: #e08338; --on-accent: #141210;
  --high: #fb8a5c; --medium: #fbbf24; --low: #4ade80; --danger: #fb7185; --on-danger: #1a0b0f;
  --ind: #f59e56; --ind-mid: #e08338; --ind-bg: #2e1d12;
  --grn: #5be08e; --grn-mid: #22c55e; --grn-bg: #11301d;
  --amb: #fcc74f; --amb-mid: #f59e0b; --amb-bg: #33260c;
  --ros: #f7a6cb; --ros-mid: #ec4899; --ros-bg: #3a1629;
  --fire: #fda06b; --fire-bg: #3a1e10;
  --ideas-bg: #1c1a17; --ideas-fg: #e6ccb2;
  --notes-bg: #0c2730; --notes-fg: #7dd3fc;
  --quotes-bg: #2b1d0c; --quotes-fg: #fcd34d;
  --concl-bg: #0b2918; --concl-fg: #86efac;
}

/* Protección completa para quien desactiva animaciones en su celular */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Desacuerdos

Tras revisar las 7 objeciones de Claude contra el código real de la aplicación (`styles.css`, `tablero.css`, `capture.css` y `calls.css`), **estoy de acuerdo con el 90 % de su filtro**, pero planteo **4 matices técnicos puntuales** donde conviene afinar la regla para no perder funciones útiles que la app ya tiene en uso:

1. **Sobre la Objeción 1 («Hover no existe en el dedo: usar `:active` y `:focus-visible`»):**
   - **Coincidencia:** En el teléfono (Android), `:hover` se queda pegado tras tocar un botón y molesta; `:active` y `:focus-visible` deben ser la base obligatoria en toda la app.
   - **Matiz de precisión:** El dueño también usa la aplicación en su computador con **Brave** y en el **widget de escritorio de Windows** (`NOTAS.md` §1 y §4; `tablero.css` tiene diseño de barra lateral para pantallas desde `1024px` en la línea 308 y `styles.css` usa `:hover` en `.widget-item` en la línea 533). Por tanto, en vez de borrar `:hover` del todo, la regla CSS correcta es aislarlo con `@media (hover: hover) and (pointer: fine)` para que en el celular jamás se active, pero en el computador sí dé respuesta visual al mover el ratón por la barra lateral o el widget.

2. **Sobre la Objeción 2 («Decide UNA familia para la app considerando que Manrope ya está en el repo»):**
   - **Coincidencia:** Toda la interfaz general (títulos, botones, pestañas, listas, formularios) debe usar únicamente **Manrope** (quitando el `system-ui` suelto de `styles.css` línea 44).
   - **Discrepancia parcial:** No debemos quitar las **dos fuentes de apoyo funcionales** del sistema que no bajan archivos de internet y cumplen una tarea específica en `styles.css`:
     1. `ui-monospace` en `.code-box` (`styles.css` línea 352) para mostrar el código de sincronización de 20 caracteres: es indispensable para no confundir letras y números al copiar o leer el código entre dispositivos.
     2. `Georgia, serif` en los párrafos de lectura de resúmenes terminados (`#book-detail .box:not(.block) p`, `styles.css` línea 590): ahí no estamos en una lista de control, sino leyendo capítulos de un libro; conservar la letra de libro en ese único lugar (o dejarla opcional) separa visualmente la lectura reposada del resto de las tareas.
     - Además, detecté un detalle oculto en `tablero.css` línea 59: tiene escrito `font-feature-settings: "tnum" 0;`, lo que desactiva los números alineados por defecto en Manrope; hay que corregir eso para que los números en listas y tablas queden siempre derechos.

3. **Sobre la Objeción 3 (Propiedades animadas y `prefers-reduced-motion`):**
   - **Coincidencia:** Hay que eliminar de raíz el rebote `cubic-bezier(.3, 1.6, .6, 1)` de `tablero.css` (líneas 108, 158 y 234).
   - **Hallazgo adicional en el código:** La app hoy incumple la regla de "solo `transform` y `opacity`" del video 6 en cuatro sitios concretos que Claude no mencionó en el diagnóstico inicial:
     1. Las barras de avance animan `width` (`styles.css` líneas 436 y 556; `tablero.css` línea 131).
     2. Las barras semanales de Inicio animan `height` (`tablero.css` línea 285).
     3. El botón flotante «Anotar» anima `bottom` cuando sale el aviso de Deshacer (`capture.css` línea 11).
     4. En `tablero.css` línea 304, la regla `@media (prefers-reduced-motion: reduce)` solo apaga `transition: none !important;`, pero **se olvidó de apagar `animation`**, dejando activas las animaciones `@keyframes` como `qc-up` o `sync-pulse`. En el bloque `:root` de arriba ya queda corregido.

4. **Sobre la Objeción 5 (Un solo acento vs. los 4 colores por pestaña de `tablero.css`):**
   - **Coincidencia:** El índigo `#4f46e5` por defecto debe salir, y el color de acento debe reservarse al 10 % (acción principal).
   - **Punto crítico de arquitectura visual:** Hoy `tablero.css` (líneas 51–55) cambia la variable `--accent` cada vez que cambias de pestaña (morado en Pendientes, verde en Rutina, ámbar en Trabajo y rosa en Resúmenes). Si mantenemos ese cambio de color global por pestaña, cualquier color único que elijamos solo se verá en una pestaña y el resto seguirá viéndose multicolor. Mi recomendación es que **`--accent` sea siempre el mismo en toda la aplicación** (dándole identidad y coherencia al botón «Anotar», a la pestaña activa y a los botones primarios), y que el verde, el ámbar y el rojo se usen solo en puntos pequeños de información (como una tarea completada, una racha o una fecha vencida).

---

## Auditoría de Claude sobre este documento

- **Desacuerdos de Gemini aceptados:** los cuatro son correctos y se comprobaron en el código: `:hover` solo dentro de `@media (hover: hover) and (pointer: fine)`; se conservan `ui-monospace` (código de sincronización) y `Georgia` (lectura de resúmenes); `font-feature-settings: "tnum" 0` en `tablero.css:59`; animaciones de `width`/`height`/`bottom` en `styles.css:436`, `styles.css:556`, `tablero.css:131`, `tablero.css:285` y `capture.css:11`; y el cambio de `--accent` por pestaña en `tablero.css:51-55`.
- **Corregido por Claude:** título del video 3 (verificado con oEmbed) y las cifras de contraste, recalculadas con la fórmula WCAG (todas pasan AA salvo `--faint`, que queda solo para desactivados).
- **Señalado por Claude:** la terracota choca con el rojo de prioridad alta (ver regla 3). Además, la paleta completa del bloque `:root` (fondo cálido `#f6f5f2`, grises nuevos) es una **propuesta** de Gemini, no algo que pidan los videos: la Fase 3 debe decidir si se adopta entera o solo se cambia el acento.
- **Límites del análisis:** Gemini Web vio los videos, pero sus lecturas visuales (`[estimado]`) pueden fallar por unos píxeles o tonos. Solo el video 1 se contrastó contra subtítulos, porque YouTube limitó la descarga de los demás. Las citas textuales en inglés (videos 5, 6 y 7) son las más fiables.
