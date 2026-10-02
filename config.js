/* Configuración del servicio. El dueño de la app edita SOLO este archivo.
   server: dirección del servidor de sincronización y avisos (tu Worker de Cloudflare, ver worker/README.md).
           Con esto puesto, cualquier persona sincroniza con un botón, sin crear su propio servidor.
   widgetDownload: enlace DIRECTO al APK del widget (Releases → widget-latest → pendientes-widget.apk): así el celular lo descarga
           sin pasar por la página de GitHub. */
window.APP_CONFIG = {
  server: "https://avisos-productividad.juanrincon-oy.workers.dev",
  widgetDownload: "https://github.com/juanps4009/Aplicaci-n-Productividad-/releases/download/widget-latest/pendientes-widget.apk",
  widgetScheme: "pendientes",
  widgetPackage: "app.productividad.widget",
};
