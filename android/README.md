# Widget de Pendientes para Android

Un widget de pantalla de inicio que muestra tus **tareas pendientes** (título, punto de color de prioridad y fecha límite),
ordenadas por fecha. Al tocar una tarea se abre tu app web **en esa tarea**.

No es una segunda app para usar: es un complemento pequeño que lee tus tareas del mismo servidor y código de sincronización que ya usas.

## Instalar (una sola vez)

1. **En la app web** (en tu celular Android): ⚙ Ajustes → *Widget de Android* → **Conectar el widget**.
   - Si aún no tienes el widget, **se descarga solo el archivo** `pendientes-widget.apk` (sin pasar por la página de GitHub). Cuando termine, toca **Abrir** y luego **Instalar**. La primera vez Android pide permiso para *instalar apps desconocidas* desde tu navegador: acéptalo solo para esto.
   - Después vuelve a la app web y toca **Conectar el widget** otra vez: el widget recibe tu código y queda conectado, sin escribir nada.
2. **Añadir el widget.** Mantén pulsado un espacio vacío de la pantalla de inicio → **Widgets** → **Pendientes (widget)** → arrástralo. Puedes cambiarle el tamaño.

**Tamaños.** Es un solo widget que se adapta al tamaño que le des (desde la versión 1.2): mantenlo pulsado y arrastra sus bordes.
- **Grande** (de 4x3 en adelante): título, ↻ y tareas de dos líneas con su fecha.
- **Compacto** (2x2, 4x2 y similares): arriba «Pendientes · N» (el número se pone en rojo si hay vencidas) y debajo las tareas en una línea. En 4x2 se ve también la fecha; en 2x2 solo el título.
En Android 12 o más nuevo se añade de 4x3 y se puede achicar a 2x2; en versiones anteriores se añade de 2x2 y se puede agrandar.

**Conectarlo a mano** (por ejemplo si prefieres no usar el botón): abre la app **«Pendientes (widget)»**. Tiene dos opciones de servidor:
- **Usar el servidor de la app** (recomendada, un toque, no escribes ninguna dirección).
- **Usar mi propio servidor** (solo si creaste uno; aparece el campo de dirección).
Luego copia tu código en la app web (Ajustes → Sincronizar) y toca **Pegar**.

**Para el dueño:** el APK lo compila GitHub solo al cambiar la carpeta `android/` y lo deja en *Releases* (etiqueta `widget-latest`, archivo `pendientes-widget.apk`). El servidor «de la app» que usa el widget sale de `server` en `config.js` (se lee al compilar). El enlace directo de descarga está en `widgetDownload` de `config.js`.

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
- Si cambias el código de sincronización en la app, vuelve a tocar «Conectar el widget» (o abre «Pendientes (widget)» y pégalo).
- **Si al añadirlo sale un error**, ya no debería: la versión 1.1 corrige un fallo de Android 14 con las plantillas de toque. Si aun así falla, dime el modelo del teléfono y la versión de Android.
