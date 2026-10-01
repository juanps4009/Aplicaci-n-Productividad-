# Widget de Pendientes para Android

Un widget de pantalla de inicio que muestra tus **tareas pendientes** (título, punto de color de prioridad y fecha límite),
ordenadas por fecha. Al tocar una tarea se abre tu app web **en esa tarea**.

No es una segunda app para usar: es un complemento pequeño que lee tus tareas del mismo servidor y código de sincronización que ya usas.

## Instalar (una sola vez)

1. **En la app web** (en tu celular Android): Ajustes → *Widget de Android* → **Conectar el widget**.
   - Si aún no tienes el widget, se abre la página de descarga: baja `pendientes-widget.apk` e instálalo (Android pedirá permiso para *instalar apps desconocidas* desde tu navegador; acéptalo solo para esto).
   - Después vuelve a la app web y toca **Conectar el widget** otra vez: el widget recibe tu código y queda conectado, sin escribir nada.
2. **Añadir el widget.** Mantén pulsado un espacio vacío de la pantalla de inicio → **Widgets** → **Pendientes (widget)** → arrástralo. Puedes cambiarle el tamaño.

(Para conectarlo a mano: abre la app «Pendientes (widget)» y escribe el servidor y el código de Ajustes → Tus dispositivos.)

**Para el dueño:** el APK lo compila GitHub solo al cambiar la carpeta `android/` y lo deja en *Releases* (etiqueta `widget-latest`). Si el widget no se conecta, revisa que `widgetDownload` en `config.js` apunte a esa página.

## Cómo se usa

- Se ven solo tareas **sin completar**: primero las vencidas, luego por fecha, y las que no tienen fecha al final (con la misma prioridad que en la app).
- **Tocar una tarea** abre la app en esa tarea y la resalta.
- **↻** actualiza la lista. Sola se actualiza cada ~30 minutos (límite de Android) y cuando agregas el widget.
- Sin conexión muestra lo último que descargó.
- Tus tareas viajan cifradas; el widget las descifra en tu celular con tu código.

## Cosas a saber

- El widget **solo lee**; no crea ni cambia tareas.
- Para que al tocar una tarea se abra tu app instalada (y no una pestaña del navegador), en Android: *Ajustes → Apps → tu app → Abrir de forma predeterminada → Abrir enlaces compatibles*. Si se abre en el navegador igual funciona, con los mismos datos.
- Para actualizar el widget en el futuro, instala el APK nuevo encima del anterior (la firma es la misma, no pierdes la configuración).
- La llave de firma (`debug.keystore`) es de depuración y es pública a propósito: sirve solo para que las actualizaciones se instalen encima. No protege nada y no es un secreto.
- Si cambias el código de sincronización o el servidor en la app, vuelve a abrir «Pendientes (widget)» y actualiza esos datos.
