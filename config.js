/* Configuración del servicio. El dueño de la app edita SOLO este archivo.
   server: dirección del servidor de sincronización y avisos (tu Worker de Cloudflare, ver worker/README.md).
           Con esto puesto, cualquier persona sincroniza con un botón, sin crear su propio servidor.
   widgetDownload: dónde se descarga el APK del widget (la página de Releases de tu repositorio). */
window.APP_CONFIG = {
  server: "https://avisos-productividad.juanrincon-oy.workers.dev/",
  widgetDownload: "https://github.com/juanps4009/Aplicaci-n-Productividad-/releases/tag/widget-latest",
  widgetScheme: "pendientes",
  widgetPackage: "app.productividad.widget",
};
