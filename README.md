# Pendientes y Resúmenes

App web instalable (PWA) para tareas con notas y recordatorios, y resúmenes de libros. Todo se guarda en tu dispositivo.

- **Usarla:** abre la dirección de la app (GitHub Pages) y, en el celular, «Añadir a pantalla de inicio». En el computador, el icono «Instalar» de Chrome o Edge.
- **Sincronizar celular y computador:** Ajustes → Tus dispositivos → *Crear código nuevo*, y en el otro dispositivo escribe el código (o escanea el QR). Los datos se cifran en tu dispositivo.
- **Widget de Android:** Ajustes → Widget de Android → *Conectar el widget*. Ver `android/README.md`.
- **Privacidad:** `privacidad.html`.

## Para quien publica la app

1. Publica esta carpeta con GitHub Pages (Settings → Pages).
2. Crea el servidor gratuito una sola vez siguiendo `worker/README.md` y pega su dirección en `config.js`.
3. El widget se compila solo en GitHub (`.github/workflows/android-widget.yml`) y queda en *Releases*.

Pruebas y herramientas: `reminders.js` y `sync.js` son lógica pura; `scripts/build-beta.py` genera `dist/beta.html` (una sola página para probar rápido).
