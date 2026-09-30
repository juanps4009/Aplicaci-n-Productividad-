# Widget de Pendientes para Android

Un widget de pantalla de inicio que muestra tus **tareas pendientes** (título, punto de color de prioridad y fecha límite),
ordenadas por fecha. Al tocar una tarea se abre tu app web **en esa tarea**.

No es una segunda app para usar: es un complemento pequeño que lee tus tareas del mismo servidor y código de sincronización que ya usas.

## Instalar (una sola vez)

1. **Conseguir el APK.** En GitHub abre tu repositorio → pestaña **Releases** → entra a **«Widget de Pendientes»** (etiqueta `widget-latest`) y descarga `pendientes-widget.apk` **desde el celular**.
   (Si no hay Release todavía: pestaña **Actions** → «Widget de Android» → espera la palomita verde. Si sale una ✕ roja, copia el mensaje de error y mándamelo.)
2. **Instalar.** Abre el archivo descargado. Android te pedirá permiso para *instalar apps desconocidas* desde tu navegador: acéptalo solo para esto.
3. **Conectar con tus datos.** Abre la app **«Pendientes (widget)»** y escribe:
   - *Dirección de tu servidor* (la misma de Ajustes → Tus dispositivos en la app).
   - *Código de sincronización* (el de la app; lo ves en Ajustes → Tus dispositivos).
   - *Dirección de la app* (ya viene puesta: la de GitHub Pages).
   Pulsa **Guardar**.
4. **Añadir el widget.** Mantén pulsado un espacio vacío de la pantalla de inicio → **Widgets** → **Pendientes (widget)** → arrástralo. Puedes cambiarle el tamaño.

## Cómo se usa

- Se ven solo tareas **sin completar**: primero las vencidas, luego por fecha, y las que no tienen fecha al final (con la misma prioridad que en la app).
- **Tocar una tarea** abre la app en esa tarea y la resalta.
- **↻** actualiza la lista. Sola se actualiza cada ~30 minutos (límite de Android) y cuando agregas el widget.
- Sin conexión muestra lo último que descargó.

## Cosas a saber

- El widget **solo lee**; no crea ni cambia tareas.
- Para que al tocar una tarea se abra tu app instalada (y no una pestaña del navegador), en Android: *Ajustes → Apps → tu app → Abrir de forma predeterminada → Abrir enlaces compatibles*. Si se abre en el navegador igual funciona, con los mismos datos.
- Para actualizar el widget en el futuro, instala el APK nuevo encima del anterior (la firma es la misma, no pierdes la configuración).
- La llave de firma (`debug.keystore`) es de depuración y es pública a propósito: sirve solo para que las actualizaciones se instalen encima. No protege nada y no es un secreto.
- Si cambias el código de sincronización o el servidor en la app, vuelve a abrir «Pendientes (widget)» y actualiza esos datos.
