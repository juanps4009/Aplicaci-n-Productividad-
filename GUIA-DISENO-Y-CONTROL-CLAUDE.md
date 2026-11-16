# Guía de Diseño y Control de Claude — «Pendientes y Resúmenes»

Este manual es tu herramienta de mando como dueño del producto.
No necesitas saber programar para exigir calidad de primer nivel: necesitas saber qué mirar en tu celular y qué palabras exactas usar para darle órdenes a Claude.

---

## Parte A — Lo que debes saber de diseño de interfaces

Una aplicación hecha por plantilla o por inteligencia artificial sin dirección se reconoce en tres segundos:
- Encierra cada grupo y cada renglón en cajas repetidas con el mismo redondeo.
- Abusa de los colores llamativos en fondos grandes donde nadie tiene que tocar.
- Pone números y porcentajes gigantes para rellenar espacio vacío.
- Olvida dónde descansa tu dedo pulgar cuando usas el teléfono con una sola mano.

Un producto artesanal como Things 3, Linear, Copilot Money o Amie se siente calmado, preciso y físico porque domina cinco principios fundamentales.

### 1. Jerarquía: una sola petición por pantalla
Si todo grita al mismo tiempo, nada se entiende.
En cada pantalla debe haber un único protagonista (lo que viniste a hacer ahí), un nivel secundario de apoyo y un nivel terciario silencioso que casi desaparece hasta que lo buscas.
- **Ejemplo en tu app (Inicio):**
  Tú entras a Inicio a ver y marcar las tres tareas más importantes de hoy o a capturar una idea rápida.
  Cuando la tarjeta superior se pinta toda de azul intenso y además pone un contador gigante de tareas hechas junto al botón azul de anotar, tienes tres elementos peleando por tu vista.
  Lo correcto es que las tres tareas estén sobre un fondo claro y tranquilo, y que el único bloque azul sólido de toda la pantalla sea el botón flotante de anotar.
- **Prueba casera de los 2 segundos:**
  Abre la pantalla, mírala durante dos segundos y apágala o cierra los ojos.
  Si lo primero que recuerdas es un número pasivo («2/8») o un bloque de color en vez del título de tu primera tarea pendiente, la jerarquía está invertida.

### 2. Tensión visual y reserva del color
Tensión es contraste a propósito: un título de 26 px muy grueso al lado de un dato de 14 px gris; una lista apretada rodeada de aire. Cuando todo mide parecido y pesa parecido, la pantalla se ve plana y de plantilla.
Con el color pasa igual. El color intenso no es decoración: es una señal de tráfico.
Si pintas un contenedor entero de azul saturado, pasa lo mismo que ocurrió en la prueba de Inicio: la palabra «Vencida» en rojo dejó de leerse sobre el azul y obligó a ponerle un parche blanco detrás.
Cuando el color intenso ocupa muy poco, cada punto rojo o azul cobra fuerza inmediata.
- **Ejemplo en tu app (Pendientes):**
  El grupo de tareas de hoy no necesita un fondo azul eléctrico para destacar.
  Si lo pintas de azul, pesa más que las tareas vencidas y cansa la vista.
  Basta con que el título del grupo lleve tinta azul y que el rojo se reserve únicamente a la fecha de las tareas vencidas.
- **Prueba casera de entrecerrar los ojos:**
  Aleja el celular a medio brazo y entrecierra los ojos hasta que las letras se vean borrosas.
  Solo deberías distinguir una mancha de color fuerte en toda la pantalla: el botón principal de acción.
  Si ves dos o tres manchas intensas compitiendo, sobra color.
- **Prueba casera del gris:**
  Pon el celular en escala de grises (Ajustes → Bienestar digital → Modo descanso, o Accesibilidad → Corrección de color).
  Si en gris ya no sabes qué es lo importante ni cuál tarea está vencida, la pantalla dependía del color y no de la jerarquía.

### 3. Densidad y espacio en lugar de cajas
El vicio más común de las plantillas automáticas es meter cada grupo y cada fila dentro de su propia tarjeta con borde y sombra.
Esas cajas se comen el espacio de tu pantalla de 390 píxeles de ancho y empujan tus tareas hacia abajo.
Los productos bien diseñados separan los grupos con aire (un margen más amplio arriba que abajo) y dividen las filas con una línea finísima de un píxel.
- **Ejemplo en tu app (Pendientes y Rutina):**
  Si pones un título grande, un cuadro para escribir arriba, tres contadores distintos y una tarjeta por cada grupo, la primera tarea aparece apenas en la mitad de la pantalla.
  Al quitar las cajas por grupo y dejar un solo contador discreto, la primera tarea sube al primer cuarto de la pantalla y ves el doble de tareas sin deslizar.
- **Prueba casera del primer pantallazo:**
  Abre cualquier pestaña de tu app sin deslizar el dedo hacia abajo.
  En la pantalla de tu celular debes ver completas al menos las tres o cuatro primeras filas de contenido real (tus tareas, tus hábitos o tus ofertas de trabajo).

### 4. Luminancia y profundidad sin sombras sucias
En el mundo real, los objetos que están más cerca de la luz se ven un poco más claros y tienen un borde definido.
Las plantillas baratas intentan dar profundidad poniendo sombras grises borrosas detrás de todo, que en modo oscuro ni siquiera se ven o ensucian el fondo.
- **Ejemplo en tu app (Sobrio y Vivo):**
  En el aspecto Vivo en modo claro, el fondo es de un tono papel piedra cálido, la tarjeta principal es blanca y tiene un borde inferior de dos píxeles que se hunde un píxel cuando la presionas, como una tecla física.
  En modo oscuro no hay sombras negras: el fondo es obsidiana profundo, las tarjetas son de un gris pizarra un poco más claro y llevan un destello blanco casi invisible en el borde superior, como si les diera una lámpara desde arriba.
- **Prueba casera del modo oscuro:**
  Pon la pantalla en modo oscuro con el brillo de tu celular a la mitad.
  Las secciones deben distinguirse con nitidez por su tono de gris y su línea de borde de un píxel, sin halos borrosos ni textos apagados que te obliguen a forzar la vista.

### 5. Ergonomía: diseño para el pulgar de una sola mano
Un celular no es un computador encogido.
Cuando sostienes el teléfono con la mano derecha, tu pulgar alcanza sin esfuerzo el tercio inferior, llega estirándose al centro y le cuesta mucho la franja de arriba, sobre todo la esquina superior izquierda.
- **Ejemplo en tu app (Captura y casillas):**
  Poner el campo para escribir una tarea nueva arriba del todo te obliga a usar las dos manos o a cambiar el agarre del teléfono.
  Por eso el botón flotante de anotar vive abajo a la derecha, justo debajo de tu pulgar. La lista queda en la zona media, donde el pulgar llega estirado; por eso marcar una tarea no depende de atinarle a la casilla: deslizas la fila entera a la derecha y queda hecha (a la izquierda, pasa a mañana).
- **Prueba casera del pulgar:**
  Toma tu celular con una sola mano como lo haces caminando por la calle.
  Intenta anotar una tarea, cambiar de pestaña y marcar el primer pendiente de hoy sin usar la otra mano y sin que el teléfono se te resbale.
  Si tienes que estirar el dedo hasta arriba para la acción principal, el control está en el lugar equivocado.

---

## Parte B — Cómo dirigir a Claude como director de arte

Cuando algo no te guste, evita frases generales como «ponlo más bonito», «se ve raro» o «hazlo más moderno».
Esas frases abiertas hacen que la inteligencia artificial improvise y agregue adornos innecesarios.
Usa siempre los términos concretos del glosario de abajo.

### 1. Glosario técnico-visual (21 términos: qué decir en vez de «más bonito»)

| Lo que tú notas en la pantalla | El término técnico exacto | Qué orden darle a Claude |
|---|---|---|
| Hay demasiadas tarjetas y recuadros | **Estructura por proximidad y divisores de 1px** | «Quita las tarjetas por grupo; sepáralos con 20px de aire y usa divisores de 1px entre filas.» |
| Un cuadro azul grande cansa la vista | **Reserva del color de acento (`--accent`)** | «Quita el relleno azul del contenedor; el azul sólido es exclusivo del botón flotante y de las casillas marcadas.» |
| Los números de dinero o fechas se ven chuecos | **Números tabulares (`tabular-nums`)** | «Aplica `tabular-nums` en todas las cifras, fechas y montos, y alinéalos al eje derecho.» |
| Los títulos grandes se ven flojos o separados | **Tracking negativo (`letter-spacing: -0.035em`)** | «Aplica peso 800 y tracking negativo a los títulos de pantalla y cifras principales.» |
| Las tareas empiezan muy abajo en la pantalla | **Primera fila accionable antes de 170px** | «Compacta la cabecera y deja una sola cifra de avance para que la primera tarea empiece antes de 170px.» |
| Hay tres o cuatro contadores diciendo lo mismo | **Una sola cifra de avance por pantalla** | «Deja una sola cifra de avance en 14px gris y elimina los contadores repetidos.» |
| El anillo redondo grande quita espacio | **Línea de avance de 4px** | «Reemplaza el anillo por una línea horizontal fina de 4px, fuera de la caja de tareas.» |
| El botón de abajo tapa el último renglón | **Respiro inferior para el flotante (`padding-bottom: 148px`)** | «Añade espacio libre al final de la lista para que el botón flotante nunca tape la última fila.» |
| Cuesta atinarle a la casilla con el dedo | **Objetivo táctil expandido (`48×48px` según Ley de Fitts)** | «Mantén la casilla visible en 22px pero amplía su área de toque invisible a 48x48px.» |
| Cada fila tiene demasiados iconos y menús | **Revelación progresiva** | «Limpia la fila en reposo (casilla, título, fecha debajo y punto); muestra las opciones al tocar la fila.» |
| Los iconos parecen sacados de una plantilla | **Glifos de trazo limpio sin cuadrito pastel** | «Quita el cuadrito de color de fondo de los iconos; déjalos en trazo limpio de 18 a 22px.» |
| El bloque principal no se distingue del fondo | **Tinte plano de superficie (`--day-tint`)** | «Usa el tinte plano precalculado en la tarjeta del día, sin degradados ni colores saturados.» |
| Las letras grises casi no se leen al sol | **Contraste mínimo WCAG AA (`4.5:1`)** | «Sube el contraste del texto secundario a `--muted` y prohíbe usar `--faint` en textos que haya que leer.» |
| Los botones no hacen nada cuando los toco | **Respuesta física al toque (`:active` + labio táctil)** | «Haz que al tocar el botón baje 1px en 100ms y cambie su texto a Guardando mientras trabaja.» |
| En modo oscuro todo se ve plano o sucio | **Elevación por luminancia y luz cenital (`inset 1px`)** | «Quita las sombras en oscuro; separa las capas por brillo de pizarra y pon luz cenital de 1px arriba.» |
| Las animaciones rebotan demasiado o dan tirones | **Curva de frenado suave en GPU (`transform` y `opacity`)** | «Anima solo `transform` y `opacity` con curva de frenado suave, sin rebote salvo el micro-pulso de la casilla.» |
| Una palabra larga se corta dejando una letra suelta | **Corte limpio de palabras (`break-word` y `line-clamp`)** | «Quita `overflow-wrap: anywhere`, usa corte por palabra con guiones en español y máximo 2 líneas por fila.» |
| Cuando no hay datos aparece un cero gigante | **Estado vacío humano de una línea** | «Oculta los ceros gigantes cuando esté vacío y muestra una frase tranquila con enlace directo para crear.» |
| Las casillas y textos se ven desalineados al bajar | **Guía óptica izquierda única (`x = 16px`)** | «Alinea todas las casillas, encabezados de grupo y títulos a una sola guía izquierda a 16px del borde.» |
| El título más grande no me dice nada | **Titular con información** | «El texto más grande debe ser un dato útil (la fecha, el nombre de la vista), no un saludo.» |
| El texto suena a robot o a comercial de ventas | **Microcopy colombiano en segunda persona** | «Reescribe el texto en español de Colombia natural, hablándome de tú, sin signos de admiración ni explicaciones técnicas.» |

### 2. Qué referencias y restricciones darle siempre a Claude
Cada vez que pidas un ajuste visual, recuérdale cuatro fronteras que no puede cruzar:
1. **Un solo código HTML para los dos estilos:** todo cambio debe funcionar tanto en el aspecto Sobrio como en el aspecto Vivo (`data-estilo="sobrio|vivo"`) y en modo claro y oscuro.
2. **Referencias de nivel mundial:** pídele que resuelva las listas y casillas como **Things 3**, la limpieza de bordes y modo oscuro como **Linear**, las cifras de dinero como **Copilot Money** y los selectores táctiles como **Amie**.
3. **Presupuesto de cajas y color:** máximo una caja protagonista por pantalla y el relleno azul intenso reservado únicamente para el botón de acción principal y las casillas marcadas.
4. **Respeto por las pruebas automáticas:** exígele que verifique la vista en formato celular de `390×844` píxeles y que corra las pruebas antes de darte por terminada una tarea.

### 3. Seis errores que debes evitar al pedir cambios
- **No pidas «rediseña toda la aplicación de una vez»:** el trabajo sale mucho más fino cuando apruebas una pantalla a la vez.
- **No pidas «ponle más color para que se vea alegre»:** eso lleva a que Claude pinte cajas enteras de azul o verde y rompa la lectura de las tareas vencidas. Pide en su lugar «contraste tipográfico, tinte plano suave y labio táctil».
- **No aceptes propuestas sin ver las 4 vistas juntas:** pide siempre ver Sobrio claro, Vivo claro, Sobrio oscuro y Vivo oscuro a `390×844` píxeles.
- **No dejes que meta dos botones para la misma acción:** si ya está el botón flotante de anotar abajo, no permitas otro botón primario ni un formulario fijo arriba.
- **No apruebes solo con datos bonitos:** exige ver cómo se comporta la pantalla cuando está vacía y cuando una tarea tiene un texto de tres renglones.
- **No apruebes mirando solo en el computador:** tu pulgar en la pantalla del celular tiene la última palabra.

### 4. Trece prompts cortos listos para copiar y pegar

1. **Auditar una pantalla sin tocar código:**
   `Audita la pantalla <nombre> aplicando docs/parametros-pro.md y la skill art-direction. Revísala a 390x844 en claro y oscuro, dime los 5 fallos más graves de jerarquía, color o ergonomía y no modifiques el código todavía.`
2. **Elevar una pantalla a nivel profesional:**
   `Reestructura la pantalla <nombre> en 390x844 siguiendo docs/parametros-pro.md. Asegura que la primera fila accionable empiece antes de y=170px, deja una sola cifra de avance y muéstrame las 4 vistas (Sobrio/Vivo en claro y oscuro).`
3. **Quitar exceso de cajas y tarjetas:**
   `En <nombre> hay demasiadas cajas. Deja máximo una superficie protagonista, separa los grupos por proximidad (24px de aire antes de cada encabezado) y usa divisores de 1px entre filas sobre una sola guía izquierda a 16px.`
4. **Corregir abuso de color:**
   `Aplica la regla de reserva quirúrgica del color en <nombre>: el relleno azul --accent es exclusivo de + Anotar y de las casillas marcadas. Pasa cualquier contenedor azul a superficie neutra o --day-tint y verifica contraste AA.`
5. **Alinear cifras, fechas y dinero:**
   `Revisa todos los números, fechas y montos de <nombre>: aplica tabular-nums, formato colombiano ($ 430.000, 13 nov), peso 800 con tracking -0.035em en la cifra principal y alinea la columna numérica derecha a 16px del borde.`
6. **Revisar ergonomía y zona del pulgar:**
   `Evalúa <nombre> con la Ley de Fitts para una sola mano en 390x844: quita controles de los primeros 200px, asegura áreas táctiles de 48x48px, que la fila entera se pueda deslizar para completar y deja padding-bottom de 148px para que + Anotar no tape filas.`
7. **Comparar contra Things 3 y Linear:**
   `Compara nuestra pantalla <nombre> contra Things 3 y Linear: elimina cualquier rastro de plantilla (iconos en cuadrito, botones de tres puntos repetidos, mini-barras redundantes) y aplica revelación progresiva.`
8. **Pulir el modo oscuro:**
   `Revisa <nombre> en modo oscuro (Sobrio y Vivo): elimina cualquier sombra negra, verifica los 3 escalones de brillo de pizarra, aplica la luz cenital inset de 1px en Vivo y confirma que ningún texto legible use --faint.`
9. **Diseñar estados vacíos y textos largos:**
   `Muéstrame <nombre> en estado vacío y con títulos de 3 líneas: elimina ceros gigantes, usa una frase cálida en español de Colombia con acción directa y verifica que ninguna palabra se corte a mitad de sílaba.`
10. **Simplificar la sección Tus áreas en Inicio:**
    `En Inicio, limpia Tus áreas: quita las mini-barras y los cuadritos de icono, sácala de la tarjeta, deja 4 filas de 48px con divisor de 1px, icono de trazo limpio de 18px y un único dato tabular a la derecha.`
11. **Auditar microcopy y tono colombiano:**
    `Revisa todos los textos visibles de <nombre>: pásalos a español de Colombia natural en segunda persona, quita signos de admiración, emojis y frases de plantilla, y verifica que los botones cambien su texto al trabajar.`
12. **Control final antes de publicar:**
    `Ejecuta la lista de revisión final de la skill art-direction sobre toda la app, corre npm run unit y npm run e2e, y confírmame que las 4 variantes visuales pasan sin errores antes de pedirte que publiques.`
13. **Preparar el encargo de una pantalla para Claude Design:**
    `Reescribe el encargo de <nombre> (colaboracion/msgs) con la skill art-direction: pega el check previo y la lista negra como restricciones, define la estructura de arriba abajo con alturas en px y pide las 4 vistas. No lo envíes todavía; muéstramelo.`

---

## Parte C — Decisiones vigentes (16 nov 2026)

Estas ya están tomadas. Si quieres cambiar alguna, dilo con su número.
1. El azul sólido es solo de «+ Anotar» y de las casillas marcadas. Ningún contenedor va relleno de azul.
2. Inicio: línea de avance de 4 px (no anillo), con una sola cifra, fuera de la caja de tareas.
3. Pendientes en el celular: solo «+ Anotar» (sin campo arriba). En el computador sí se conserva el campo.
4. Una sola caja protagonista por pantalla. «Tus áreas» y los grupos de Pendientes van sin tarjeta.
5. La fecha y el estado van debajo del título de la tarea; a la derecha solo el punto de prioridad.
6. Propuesta por confirmar: que el titular de Inicio sea la fecha y el saludo pase a letra pequeña.

Archivos: la skill está en `.claude/skills/art-direction/SKILL.md`, las medidas por pantalla en `docs/parametros-pro.md` y el estado del trabajo en `colaboracion/ESTADO.md`.
