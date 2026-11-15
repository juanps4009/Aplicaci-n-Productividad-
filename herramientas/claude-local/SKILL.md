---
name: llamar-al-dueno
description: Llamar al celular del dueño (suena aunque esté bloqueado; contesta una voz que le explica y vuelve con su respuesta) o dejarle un mensaje en su app Pendientes. Úsala cuando necesites su permiso o una decisión para seguir y él no está mirando el chat, o cuando él pida «llámame», «avísame al celular» o «déjame un mensaje».
---

# Llamar o escribirle al dueño

La herramienta está en tu computador:

```
node "{{LLAMAR}}" <orden>
```

(Si esa ruta no existe, dile al dueño que vuelva a abrir `Activar-llamadas-Claude.cmd`.)

## Cuándo usar cada cosa
- **Llamar** solo para pedir un permiso o una decisión que bloquea el trabajo (por ejemplo: borrar algo, gastar dinero, publicar, elegir entre caminos). Nunca para avisos ni charla.
- **Mensaje** para avisos: «terminé», «te dejé el resumen», «falló tal cosa». Le llega una notificación al celular.
- Si el dueño está respondiendo en el chat, pregúntale ahí; no lo llames.

## Órdenes
- `estado`: comprueba que haya un celular con llamadas activadas. Úsala antes de la primera llamada de la sesión.
- `llamar "motivo corto" --contexto "…"`: el celular suena y la orden espera hasta 15 min a que la llamada termine; al final muestra la transcripción. Para un contexto largo usa `--contexto-archivo archivo.md`. Con `--urgente` suena aunque sea tarde.
- `mensaje "texto"`: le deja un mensaje en la app.
- `respuestas --esperar 600`: espera lo que el dueño escriba o encargue en la app.
- `encargos` / `encargo hecho <id>`: lo que el dueño pidió para Claude y falta atender.

## Cómo preparar una llamada
Quien habla con él no eres tú, sino una voz (Gemini) que solo sabe lo que pongas en `--contexto`. Escribe en español:
1. Qué estás haciendo y por qué necesitas su respuesta, en 2–3 frases.
2. Las opciones numeradas, cada una con su efecto y su costo o riesgo.
3. «Pídele que elija un número y repítele su elección antes de colgar.»

Lee la transcripción y haz lo que eligió. Si no contestó o la respuesta no es clara, la llamada queda como mensaje: deja también las opciones con `mensaje`, sigue con lo que no dependa de esa decisión y no hagas nada irreversible.

## Reglas
- Todo habla en español, corto y claro.
- Nunca leas, imprimas ni copies el código de sincronización (archivo `.pendientes\codigo.txt` o variable `PENDIENTES_CODIGO`): la herramienta lo usa sola.
- Nunca mandes mensajes a terceros, apliques a ofertas ni gastes dinero sin su confirmación.
- Si la herramienta dice que falta el código o el celular, explícale al dueño en una frase y sigue sin llamar.
