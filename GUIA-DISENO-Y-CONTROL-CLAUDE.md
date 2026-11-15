# Guía de diseño: cómo dirigir a Claude

Esta guía es para ti. Resume lo que enseñaron los 10 videos, te da palabras precisas para pedir cambios y explica cómo trabajar pantalla por pantalla. Las reglas técnicas que sigue Claude están en `.claude/skills/art-direction/SKILL.md`, y el análisis completo de los videos en `docs/analisis-videos.md`.

## 1. Lo que dicen los 10 videos

Casi todos coinciden en lo mismo:

1. **Lo que delata una app hecha con IA:** el morado-índigo con degradados, tres o cuatro tarjetas iguales en fila, el mismo redondeo en todo, la fuente Inter, paneles de vidrio borroso y textos huecos de plantilla. Tu app tiene varias de esas: el índigo, las cuatro tarjetas de Inicio y un color distinto en cada pestaña.
2. **El orden lo dan el tamaño y el espacio, no las cajas.** Lo importante va grande, lo secundario pequeño y gris, y entre bloques queda aire. Encerrar todo en tarjetas es el error más común.
3. **Una sola cosa importante por pantalla.** El video 5 lo resume en «One ask per screen»: si todo destaca, no destaca nada.
4. **Un solo color de acento, y poco.** La regla 60/30/10: 60 % fondo, 30 % superficies y 10 % acento, solo para el botón principal.
5. **Una fuente elegida a propósito y pocos tamaños**, con diferencias claras entre título, texto y nota.
6. **Bordes finos en vez de sombras.** En modo oscuro, lo que está «más arriba» se ve un poco más claro.
7. **Movimiento que frena suave y no rebota.** El video 7 lo dice así: «nada se pasa de su marca». Solo se mueve con desplazamiento y transparencia, para que no dé tirones en el celular.
8. **El celular no es un computador encogido.** Hay que decidir qué se ve primero en la pantalla pequeña.
9. **Se trabaja por partes y con un sistema fijo**, no con un «ponlo bonito» de una sola vez.

Lo que se descartó, porque sirve para páginas de publicidad pero no para una app de tareas: videos de fondo, animaciones atadas al scroll, títulos gigantes de 60–90 px, márgenes enormes, fuentes de moda descargadas de internet y efectos que siguen al ratón.

## 2. Cómo entrenar el ojo: barato vs. cuidado

| Se ve barato | Se ve cuidado |
|---|---|
| Todo en cajas con sombra | Filas limpias separadas por una línea finita |
| Cinco colores compitiendo | Un acento y el resto en grises |
| Todo del mismo tamaño, o todo grande | Tres niveles claros: título, texto, nota gris |
| «0%» y «Ninguna» en letra gigante | Una línea tranquila: «Nada pendiente para hoy» |
| Botones que no responden al tocarlos | Se hunden un poquito al tocarlos y dicen «Guardando…» |
| Animaciones que rebotan | Movimiento corto que frena suave |
| Textos de anuncio: «¡Potencia tu día!» | Textos directos: «Anotar», «Para hoy» |
| Iconos de distintos estilos y emojis | Iconos de línea, todos del mismo grosor |
| Márgenes al azar | Espacios que se repiten (8, 16, 24…) |

Truco para revisar: **entrecierra los ojos** frente a la pantalla. Lo primero que ves debería ser lo más importante. Si ves manchas de color por todos lados, hay demasiado acento.

## 3. Diccionario «lo que siento» → «lo que pido»

| Si sientes que… | Pídelo así |
|---|---|
| «Está muy cargado» | «Baja la densidad: quita cajas, usa divisores y deja más aire entre secciones.» |
| «Todo se ve igual de importante» | «Arregla la jerarquía: ¿qué es primario, secundario y terciario aquí?» |
| «Se ve de IA / de plantilla» | «Pásale la lista negra anti-slop de la skill art-direction a esta pantalla.» |
| «Tiene demasiados colores» | «Aplica 60/30/10: el acento solo en la acción principal.» |
| «Las letras se ven desordenadas» | «Ajusta esta pantalla a la escala de 5 tamaños.» |
| «Se ve plano / sin profundidad» (oscuro) | «Usa elevación por brillo: superficie más clara y borde de 1px.» |
| «Se ve pesado» | «Quita sombras y reduce radios a la escala sm/md/lg.» |
| «Los botones se sienten muertos» | «Agrega estado de toque (:active) y estado de trabajo («Guardando…»).» |
| «La animación se siente rara / lenta» | «Usa las curvas y duraciones de la skill, sin rebote.» |
| «Da tirones al bajar» | «Revisa rendimiento: solo transform/opacity y nada de blur.» |
| «No sé qué hacer cuando está vacío» | «Rediseña el estado vacío: una línea y una acción.» |
| «Se ve apretado en mi celular» | «Captura a 390 px y revisa márgenes de 16 px y botones de 44 px.» |
| «En oscuro se ve mal» | «Revisa contraste AA en tema oscuro.» |
| «El texto suena raro» | «Revisa los textos de la interfaz con humanizer y revisor-espanol.» |

## 4. Plantillas para pedir cosas

Copia y cambia lo que está entre `< >`:

- **Auditoría visual:** «Audita la pantalla `<Pendientes>` con la skill art-direction. Toma capturas a 390 px en claro y oscuro, dame los 5 problemas más graves en orden y no cambies nada todavía.»
- **Limpiar algo que se ve de IA:** «La parte `<tarjetas de Inicio>` se ve de plantilla. Propón 2 alternativas con captura de cada una y no publiques.»
- **Densidad:** «En `<Rutina>` quiero ver más cosas sin bajar. Compacta sin perder legibilidad y muéstrame un antes y después.»
- **Estados:** «Diseña todos los estados de `<la lista de oportunidades>`: vacía, una, muchas, texto muy largo y error.»
- **Movimiento:** «Revisa las animaciones de `<abrir una tarea>`: que frenen suave, sin rebote, y que respeten "reducir movimiento".»
- **Textos:** «Reescribe los textos de `<Ajustes>` para que sean cortos, directos y en tu-tú, sin sonar a anuncio.»
- **Comparar:** «Hazme 2 versiones de `<la barra de abajo>` y mándame las capturas lado a lado para elegir.»

## 5. Cómo trabajamos

1. **Una pantalla o una pieza a la vez.** Nunca «rediseña toda la app».
2. **Claude propone primero:** escribe en pocas líneas qué es lo importante en esa pantalla y qué va a cambiar.
3. **Claude cambia y te manda capturas** del celular en claro y oscuro, con un antes y después.
4. **Tú respondes con algo concreto,** idealmente con palabras del diccionario: «la lista me gusta, el título está muy grande, el gris de las fechas casi no se lee».
5. **Pruebas automáticas en verde, commit y subida a la rama de trabajo.** La app publicada no cambia hasta que tú digas «publícalo».
6. **Pruébalo en tu celular de verdad.** Las capturas ayudan, pero tu dedo y tu pantalla mandan.

Cómo dar buena retroalimentación: di **qué** (la pieza), **qué sientes** (pesado, apagado, confuso) y, si lo sabes, **qué esperabas**. Una captura de tu celular con una flecha o un círculo vale más que un párrafo.
