# Tareas programadas de Claude (en la nube)

Instrucciones listas para crear tareas programadas en claude.ai/code que trabajan con la app del dueño usando
`herramientas/rutina.mjs` (rutina, tareas, oportunidades) y `herramientas/llamar.mjs` (mensajes, encargos y llamadas).

## Lo que tiene que estar listo antes (una sola vez)

1. **El entorno de la nube llega al servidor.** La dirección del Worker (`avisos-productividad.juanrincon-oy.workers.dev`)
   tiene que estar en los *hosts permitidos* del entorno. Si no, `node herramientas/llamar.mjs estado` responde
   «Sin conexión con el servidor» (el proxy devuelve 403).
2. **El código de sincronización como variable del entorno `PENDIENTES_CODIGO`.** Lo pone el dueño en la configuración del
   entorno (claude.ai → Code → Entornos). Claude nunca lo pide por chat, nunca lo imprime y nunca lo sube al repositorio.
3. **El servidor con las llamadas configuradas** (Firebase y Gemini, ver `worker/README.md`) y el **widget 2.0 con las
   llamadas activadas** en el celular. Sin esto, los mensajes funcionan igual, pero `llamar` responde que no hay celular.
4. Comprobar: `node herramientas/llamar.mjs estado` y `node herramientas/rutina.mjs revisar`.

## 1. Atender encargos (cada pocas horas; el dueño elige la frecuencia, mínimo cada hora)

> Trabajas para el dueño de la app «Pendientes y Resúmenes» (repositorio en la carpeta actual). Ejecuta
> `node herramientas/llamar.mjs encargos --json`. Si no hay encargos, termina sin hacer nada más.
> Para cada encargo: hazlo si se puede con lo que tienes (investigar en la web, redactar, resumir, revisar la app con
> `node herramientas/rutina.mjs hoy`). Contesta con `node herramientas/llamar.mjs mensaje "…"` (en español, corto y claro,
> con enlaces si los hay) y márcalo con `node herramientas/llamar.mjs encargo hecho <id>`.
> Si el encargo necesita una decisión del dueño, déjale la pregunta como mensaje y no lo marques como hecho.
> Si es urgente y necesitas respuesta ya, usa `node herramientas/llamar.mjs llamar "motivo" --contexto "…"` y actúa según la
> transcripción. Nunca envíes mensajes, apliques a ofertas ni gastes dinero en nombre del dueño sin su confirmación.
> No imprimas ni guardes el código de sincronización.

## 2. Comentario semanal (falta que el dueño diga el día y la hora)

> Ejecuta `node herramientas/rutina.mjs ver --json` (semana actual) y `node herramientas/rutina.mjs hoy`. Escribe un comentario
> breve en español sobre cómo le fue la semana (qué cumplió, qué se le dificultó y una sugerencia concreta para la próxima),
> guárdalo con `node herramientas/rutina.mjs comentario --texto "…"` y avísale con
> `node herramientas/llamar.mjs mensaje "Tu resumen de la semana ya está en Rutina: …(una frase)…"`.

## 3. Radar de empleos (pendiente: cuenta de Workana, nivel de inglés y muestras de trabajo)

> Busca 3 a 6 ofertas nuevas de trabajo remoto según el perfil de NOTAS.md §5 (redacción, traducción, transcripción, diseño,
> atención por chat o programación; unas 8 h semanales; sin ventas por comisión ni pagos para empezar; descarta las que
> prohíban IA). Antes de añadir, revisa que no estén ya (`node herramientas/rutina.mjs oportunidades --todas`). Añade cada una
> con `node herramientas/rutina.mjs oportunidad agregar "título" --enlace URL --cierra AAAA-MM-DD --fuente "…" --nota "…"`
> (quedan «por revisar») y al final avisa con `node herramientas/llamar.mjs mensaje "Radar: N ofertas nuevas en Trabajo."`.
> Si no encontraste nada que encaje, dilo en el mensaje. Nunca apliques ni escribas a nadie en nombre del dueño.
