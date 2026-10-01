# Servidor de la app (lo crea el dueño UNA sola vez; las demás personas no hacen nada)

Un "servidor" es una cajita gratuita en internet. Este se encarga de:

1. **Sincronizar** las tareas y resúmenes entre los dispositivos de una persona (celular, computador y widget).
2. **Avisos con la app cerrada**: entrega los recordatorios a la hora exacta.

**Quien publica la app crea este servidor una vez y pega su dirección en `config.js`.** Desde ese momento cualquier persona que abra la app sincroniza con un botón («Crear código nuevo») sin crear nada. Quien quiera, puede usar su propio servidor en Ajustes → *Servidor propio (avanzado)*.

## Privacidad (para el dueño y para los usuarios)

- Las tareas y resúmenes se **cifran en el dispositivo** (AES-256-GCM con una clave derivada del código de cada persona). El servidor solo guarda datos ilegibles: **no puedes leer lo de nadie**.
- Los avisos también viajan cifrados con una clave que solo tiene cada dispositivo.
- El servidor no guarda el código, solo una huella (SHA-256) que no permite recuperarlo. Quien pierda su código en todos sus dispositivos no puede recuperar lo sincronizado.
- Cada persona puede borrar sus datos del servidor desde Ajustes. La página `privacidad.html` lo explica a los usuarios.

## Límites que protegen tu cuota gratuita

Por cada código: máximo 3000 registros y ~3 MB. Por dirección IP: 120 peticiones por minuto; por código: 40 por minuto. Tope global de 20 000 códigos y 20 000 dispositivos con avisos. Si se alcanza algún límite, la app sigue funcionando en el dispositivo y muestra un aviso en lugar de fallar.
El plan gratuito de Cloudflare (revisa las cifras vigentes en su sitio) alcanza para muchos usuarios con uso normal, porque la app solo consulta mientras está a la vista. Si algún día el servicio se llena, Cloudflare ofrece un plan de pago económico.

## Pasos para crear el servidor (unos 10 minutos, desde el navegador)

Los nombres de los menús de Cloudflare cambian de vez en cuando; si algo no coincide, busca la opción con un nombre parecido.

1. **Cuenta.** Entra a <https://dash.cloudflare.com/sign-up> y crea una cuenta gratuita.
2. **Base de datos.** Menú izquierdo → *Storage & databases* → *D1 SQL database* → **Create database**. Nómbrala `avisos` y créala. No hace falta crear tablas: el servidor las crea solo.
3. **El Worker.** Menú izquierdo → *Compute* (o *Workers & Pages*) → **Create** → *Create Worker*. Nombre: `avisos-productividad` → **Deploy**.
4. **Pegar el código.** En la pantalla del Worker pulsa **Edit code**. Borra todo el código de ejemplo, abre el archivo `worker/index.js` de este repositorio, copia *todo* su contenido y pégalo. Pulsa **Deploy**.
5. **Conectar la base.** Worker → *Settings* → *Bindings* → **Add** → *D1 database*. En *Variable name* escribe exactamente `DB` y elige la base `avisos`. Guarda / **Deploy**.
6. **Programar cada minuto.** Worker → *Settings* → *Triggers* (o *Trigger Events*) → **Add Cron Trigger** → escribe `* * * * *` y guarda.
7. **Comprobar.** Abre la dirección de tu Worker (termina en `.workers.dev`). Debe decir **«Servidor de avisos funcionando ✓»**.
8. *(Opcional, recomendado)* Worker → *Settings* → *Variables and Secrets* → **Add** → nombre `VAPID_SUBJECT`, valor `mailto:tu-correo@ejemplo.com`.

## Ponerlo en la app para todos (dueño)

1. Abre `config.js` en tu repositorio y pega la dirección de tu Worker en `server`, por ejemplo `server: "https://avisos-productividad.TU-USUARIO.workers.dev"`.
2. Guarda el cambio (commit). GitHub Pages lo publica en uno o dos minutos.
3. Listo: la app ya sincroniza con ese servidor de fábrica.

## En la app (avisos con la app cerrada)

1. Abre la app **instalada** → ⚙ Ajustes → *Tus dispositivos* → *Dirección de tu servidor*: pega la dirección de tu Worker (con `https://`) y pulsa **Conectar**.
2. Más arriba, en *Avisos en este dispositivo*, pulsa **Permitir notificaciones** y activa el interruptor **También con la app cerrada**.
3. Debe decir «Activo · N avisos programados». Prueba: en una tarea, menú ⋮ → *Recordatorio* → *Fecha y hora* dentro de 2 minutos, cierra la app y espera.

## Usar la app en el celular y en el computador (mismos datos)

**Computador:** abre la misma dirección de la app (la de GitHub Pages) en Chrome o Edge. Puedes instalarla como app de escritorio con el icono «Instalar» de la barra de direcciones (o menú ⋮ → *Instalar…*).

**Unir los dos dispositivos** (una sola vez):
1. En el primero: ⚙ Ajustes → *Tus dispositivos* → pega la dirección del servidor → **Conectar** → **Crear código nuevo**. Aparece un código como `K7QM-2XPD-9RVA-4HNT-B3WE`.
2. En el segundo: pega la misma dirección del servidor → **Conectar** → escribe el código en *Unirme con este código* (o usa el QR, abajo).
3. Listo: cada cambio se sube a los pocos segundos y se baja en el otro dispositivo (al abrir la app y cada minuto con la app visible). Hay un botón **Sincronizar ahora**.

**Con QR:** crea el código en el computador, pulsa **Mostrar QR** y escanéalo con la cámara normal del celular. Se abre la app, te pregunta si quieres unir el dispositivo y listo.

Cosas de la sincronización:
- El código es la llave: quien lo tenga puede ver y cambiar tus datos. No lo compartas. Puedes **Desvincular** un dispositivo cuando quieras (sus datos se quedan en él).
- Si ya tenías datos en los dos dispositivos, al unirlos **se suman** (no se pierde nada).
- Si cambias lo mismo en los dos a la vez, gana el cambio más reciente de esa tarea o de ese resumen completo.
- Cada dispositivo decide si recibe recordatorios (*Recibir recordatorios aquí*). El modo oscuro también es de cada dispositivo. Un «posponer» solo suena en el dispositivo donde lo pospusiste.
- Tus tareas y resúmenes se guardan en tu propia base de Cloudflare sin cifrar. Es tu cuenta, pero pensarlo antes de guardar datos muy sensibles.

## Cosas a saber

- **Android (Chrome):** funciona con la app instalada o en el navegador. El ahorro de batería de algunos fabricantes puede retrasar un aviso unos minutos.
- **iPhone:** solo funciona si añades la app a la pantalla de inicio (iOS 16.4 o más reciente).
- **Privacidad:** el servidor guarda el título de la tarea y la hora de cada aviso hasta enviarlo; después lo borra. Las claves de cifrado se crean solas y se guardan en tu propia base.
- **Límites gratuitos** (revísalos en Cloudflare, pueden cambiar): el uso de esta app queda muy por debajo.
- **Desactivar:** en Ajustes pulsa *Desactivar avisos con la app cerrada*; se da de baja el dispositivo en el servidor.
- **Si cambias de Worker** (otra dirección), activa de nuevo: la app se vuelve a suscribir con la nueva clave.

## Con línea de comandos (opcional)

`wrangler.toml` está incluido: crea la base con `npx wrangler d1 create avisos`, pon el `database_id` en el archivo y ejecuta `npx wrangler deploy` dentro de `worker/`.
