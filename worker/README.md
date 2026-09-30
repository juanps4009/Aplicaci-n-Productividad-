# Servidor de avisos (para recibir recordatorios con la app cerrada)

Sin esto, la app avisa cuando está abierta o al abrirla. Con esto, el aviso llega **a la hora exacta aunque la app esté cerrada**.
Es gratis (plan gratuito de Cloudflare) y es tuyo: nadie más lo usa.

Lo que hace: la app le envía al servidor el texto y la hora de tus próximos recordatorios (14 días). Cada minuto el servidor revisa cuáles ya tocan y los manda como notificación al celular. Al completar o borrar una tarea, sus avisos se cancelan solos.

## Pasos (unos 10 minutos, desde el navegador)

Los nombres de los menús de Cloudflare cambian de vez en cuando; si algo no coincide, busca la opción con un nombre parecido.

1. **Cuenta.** Entra a <https://dash.cloudflare.com/sign-up> y crea una cuenta gratuita.
2. **Base de datos.** Menú izquierdo → *Storage & databases* → *D1 SQL database* → **Create database**. Nómbrala `avisos` y créala. No hace falta crear tablas: el servidor las crea solo.
3. **El Worker.** Menú izquierdo → *Compute* (o *Workers & Pages*) → **Create** → *Create Worker*. Nombre: `avisos-productividad` → **Deploy**.
4. **Pegar el código.** En la pantalla del Worker pulsa **Edit code**. Borra todo el código de ejemplo, abre el archivo `worker/index.js` de este repositorio, copia *todo* su contenido y pégalo. Pulsa **Deploy**.
5. **Conectar la base.** Worker → *Settings* → *Bindings* → **Add** → *D1 database*. En *Variable name* escribe exactamente `DB` y elige la base `avisos`. Guarda / **Deploy**.
6. **Programar cada minuto.** Worker → *Settings* → *Triggers* (o *Trigger Events*) → **Add Cron Trigger** → escribe `* * * * *` y guarda.
7. **Comprobar.** Abre la dirección de tu Worker (termina en `.workers.dev`). Debe decir **«Servidor de avisos funcionando ✓»**.
8. *(Opcional, recomendado)* Worker → *Settings* → *Variables and Secrets* → **Add** → nombre `VAPID_SUBJECT`, valor `mailto:tu-correo@ejemplo.com`.

## En la app

1. Abre la app **instalada** (no desde una pestaña cualquiera) → ⚙ Ajustes → *Avisos con la app cerrada*.
2. Pega la dirección de tu Worker (con `https://`) y pulsa **Activar avisos con la app cerrada**. Acepta el permiso de notificaciones.
3. Debe decir «Activo · N avisos programados». Prueba: en una tarea, menú ⋮ → *Recordatorio* → *Fecha y hora* dentro de 2 minutos, cierra la app y espera.

## Cosas a saber

- **Android (Chrome):** funciona con la app instalada o en el navegador. El ahorro de batería de algunos fabricantes puede retrasar un aviso unos minutos.
- **iPhone:** solo funciona si añades la app a la pantalla de inicio (iOS 16.4 o más reciente).
- **Privacidad:** el servidor guarda el título de la tarea y la hora de cada aviso hasta enviarlo; después lo borra. Las claves de cifrado se crean solas y se guardan en tu propia base.
- **Límites gratuitos** (revísalos en Cloudflare, pueden cambiar): el uso de esta app queda muy por debajo.
- **Desactivar:** en Ajustes pulsa *Desactivar avisos con la app cerrada*; se da de baja el dispositivo en el servidor.
- **Si cambias de Worker** (otra dirección), activa de nuevo: la app se vuelve a suscribir con la nueva clave.

## Con línea de comandos (opcional)

`wrangler.toml` está incluido: crea la base con `npx wrangler d1 create avisos`, pon el `database_id` en el archivo y ejecuta `npx wrangler deploy` dentro de `worker/`.
