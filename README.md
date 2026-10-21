# Consulta

App móvil (iPhone y Android) para gestionar las citas y la facturación de una consulta de psicología con un único terapeuta.

## Qué hace esta versión

- **Sesiones:** lista semanal de citas. Cada sesión se marca como programada, realizada, cancelada a tiempo, cancelada con menos de 24 h o no asistida, y como pagada o pendiente.
- **Sin cobrar:** sesiones cobrables pendientes de pago, agrupadas por paciente, con su total y botón para marcarlas pagadas.
- **Nueva cita:** crea la cita y abre WhatsApp o el email con el aviso ya escrito para el paciente.
- **Pacientes:** alta y edición, con precio por sesión y datos de facturación (particular o empresa).
- **Facturas:** reúne las sesiones cobrables y sin facturar de un paciente en un mes y emite la factura con número correlativo. Aplica la exención de IVA y, a empresas, la retención de IRPF.
- **Trimestre:** facturas emitidas por trimestre con base, retenciones y total, y envío a la gestoría como CSV (separador «;», se abre en Excel).
- **Ajustes:** datos fiscales del terapeuta, serie y numeración de facturas.

Reglas de cobro: se cobran las sesiones realizadas, las canceladas con menos de 24 h de antelación y las ausencias sin aviso.

Los datos se guardan en el móvil con SQLite.

## Próximas versiones

1. Vista de calendario semanal y mensual, con alta de citas tocando un hueco.
2. PDF de la factura y envío por email o WhatsApp.
3. Notas breves por sesión, cifradas en el móvil.
4. Bloqueo con Face ID o huella.
5. Sincronización entre iPhone y Android con Supabase (plan gratuito, región UE).

## Desarrollo

```bash
npm install
npm test            # reglas de cobro, facturas y mensajes
npm run typecheck
npx expo start      # abre la app en Expo Go escaneando el código QR
```

Estructura:

- `src/domain/`: reglas de negocio sin dependencias de React Native (con tests en `__tests__`).
- `src/db/`: esquema SQLite, migraciones y consultas.
- `src/app/`: pantallas (Expo Router).
- `src/ui/`: componentes y colores compartidos.

Los importes se guardan en céntimos.

## Instalar en Android

1. Crea una cuenta gratuita en https://expo.dev.
2. En un ordenador con Node instalado, dentro de esta carpeta:
   ```sh
   npm install --legacy-peer-deps
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```
   La primera vez pregunta si crea el proyecto en Expo y la clave de firma: responde que sí a ambas.
3. Al terminar (unos 10-20 minutos), Expo muestra un enlace y un código QR. Ábrelo en la tablet, descarga el APK y acepta instalar apps de origen desconocido.

Para actualizar, repite el paso 2 e instala el nuevo APK encima. Los datos se conservan al actualizar, pero **se borran si se desinstala la app**.

## Versión web (iPhone, iPad y ordenador)

La misma app funciona en el navegador. En el iPhone y el iPad se añade a la pantalla de inicio y se abre como una app más, sin pagar la cuenta de Apple Developer.

**Publicarla (gratis, con EAS Hosting de Expo, la misma cuenta del APK):**
```sh
npm install --legacy-peer-deps
npx eas-cli login           # o la variable EXPO_TOKEN
npm run web:publicar
```
La primera vez pide un nombre para la dirección (por ejemplo `consulta-teresa`) y queda en `https://consulta-teresa.expo.app`. Para actualizarla, repite `npm run web:publicar`. El plan gratuito de EAS Hosting da de sobra para una consulta.

También sirve Cloudflare Pages o Netlify (gratis): orden de compilación `npx expo export -p web`, carpeta `dist`. El archivo `public/_headers` ya pone las cabeceras necesarias.

**Instalarla en el iPhone:** abre la dirección en Safari › botón Compartir › «Añadir a pantalla de inicio». Ábrela siempre desde ese icono: así los datos no se borran aunque pase tiempo sin usarla. Después, en Ajustes: conecta Supabase (los mismos datos que en la tablet) y pon una contraseña de bloqueo; luego puedes añadir Face ID.

**Qué cambia respecto a la app de la tablet:**
- Bloqueo: contraseña de ese dispositivo y, si se quiere, Face ID o huella (passkey) en lugar del bloqueo del sistema.
- Fecha y hora de la cita con las ruedas del iPhone.
- La copia de seguridad se descarga como archivo (en el iPhone, Archivos › Descargas) y se restaura eligiendo el archivo.
- El PDF del trimestre se abre en el diálogo de imprimir; desde ahí se guarda como PDF.
- La copia diaria en Google Drive y la publicación en Google Calendar se hacen solo desde la tablet. Las citas creadas en el iPhone llegan a la tablet al sincronizar y, desde ella, a Google Calendar.
- Se abre en una sola pestaña a la vez (la base de datos del navegador no se puede compartir entre pestañas).

**Detalles técnicos:** SQLite funciona en el navegador con WebAssembly y necesita las cabeceras `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` (`require-corp` porque Safari no admite `credentialless`). Las ponen `app.json` (EAS Hosting), `public/_headers` (Cloudflare/Netlify), `metro.config.js` (desarrollo) y, si faltan, `public/sw.js`. Los archivos `*.web.ts(x)` sustituyen a los nativos en la web.

## Dónde se guardan los datos

En cada tablet, en una base de datos SQLite (`consulta.db`) dentro del espacio privado de la app. En la versión web, dentro del almacenamiento del navegador de ese dispositivo. Si se configura Supabase, se copian también en vuestro proyecto de Supabase, que es lo que mantiene las dos tablets iguales.

## Sincronizar las tablets con Supabase (gratis)

1. Entra en https://supabase.com y crea un proyecto nuevo. En la región elige una de Europa, por ejemplo Frankfurt, y guarda la contraseña de la base de datos.
2. En **SQL Editor**, pega el contenido de [`supabase/esquema.sql`](supabase/esquema.sql) y pulsa **Run**.
3. En **Authentication › Users › Add user › Create new user**, crea la cuenta de la consulta con email y contraseña y marca *Auto Confirm User*.
4. En **Authentication › Sign In / Providers**, desactiva *Allow new users to sign up* para que nadie más pueda crear cuentas.
5. En **Project Settings › API**, copia la *Project URL* y la clave pública (*anon* o *publishable*). No uses la *service_role* ni la *secret*.
6. En cada tablet: **Ajustes › Sincronización entre tablets**, rellena los cuatro campos y pulsa **Conectar y sincronizar**.

A partir de ahí la app sincroniza sola cada dos minutos y al abrirla o cerrarla. Si la misma sesión se cambia en las dos tablets, se queda el cambio más reciente. Cada fila solo la puede ver la cuenta que la creó.

- Emite las facturas siempre desde la misma tablet, o sincroniza justo antes, para que dos tablets sin conexión no den el mismo número a dos facturas.
- El plan gratuito de Supabase pausa el proyecto tras una semana sin uso. Se reactiva desde el panel de Supabase.

## Copia de seguridad en Google Drive

**Ajustes › Copia de seguridad › Guardar copia en Google Drive** pide una contraseña, crea un archivo `Consulta copia AAAA-MM-DD HHMM.json` cifrado con AES-256 y abre el menú de compartir. Sin la contraseña la copia no se puede abrir, así que hay que guardarla en un sitio seguro. Ahí se elige Drive y la carpeta. La app avisa si pasa más de una semana sin copia.

**Restaurar una copia** permite elegir el archivo, también desde Drive, y muestra cuántos pacientes, sesiones y facturas contiene antes de sustituir los datos. Lo restaurado se envía a la otra tablet en la siguiente sincronización.

## Bloqueo

Con **Ajustes › Bloqueo** activado (viene activado), la app pide huella, Face ID o el código de la tablet al abrirse y cuando vuelve tras más de un minuto en segundo plano. Si la tablet no tiene código ni huella, la app no se puede bloquear y lo avisa en Ajustes.

## Copia automática diaria en Google Drive

Una vez al día, la primera vez que se abre la app, se sube una copia cifrada a la carpeta «Consulta - copias de seguridad» de Google Drive. Se conservan las 30 últimas. Para activarla hay que crear una vez las credenciales en Google Cloud (gratis, unos 15 minutos):

1. En https://console.cloud.google.com crea un proyecto llamado «Consulta».
2. **APIs y servicios › Biblioteca**: activa **Google Drive API**.
3. **Google Auth Platform**: tipo *Externo*, nombre «Consulta» y tu email. En **Acceso a datos** añade el permiso `.../auth/drive.file`. En **Público**, pulsa **Publicar app**. Si se deja «en pruebas», Google desconecta la cuenta cada 7 días. `drive.file` no es un permiso sensible, así que Google no pide revisión.
4. **Clientes › Crear cliente › Android**:
   - Paquete: `com.cbernal.consulta`.
   - Huella SHA-1: la que muestra `npx eas-cli credentials -p android`, en *Keystore*.
5. Solo para iPhone o iPad, **Crear cliente › iOS** con el bundle ID `com.cbernal.consulta`:
   - Copia el *ID de cliente*, que se pega en Ajustes del iPhone o iPad.
   - Copia también el *esquema de URL de iOS* y guárdalo para la compilación con `npx eas-cli env:create --name GOOGLE_IOS_URL_SCHEME --value com.googleusercontent.apps.…`.
6. Compila de nuevo la app. En la tablet, ve a **Ajustes › Copia automática diaria**, pulsa **Conectar con Google**, marca la casilla y elige la contraseña de las copias.

La contraseña de las copias automáticas se guarda en el almacén seguro del dispositivo (Keychain o Keystore). Apúntala también en otro sitio, porque hace falta para restaurar una copia en otra tablet.

## Calendario y Google Calendar

La pestaña **Calendario** tiene tres vistas:
- **Día**: la vista por defecto en el móvil, con una tira de la semana arriba.
- **Semana**: la vista por defecto en la tablet.
- **Mes**: en el móvil, cada sesión es una barra de color.

Las sesiones pagadas aparecen en verde sólido con una **P**. Al tocar un hueco libre se crea una cita a esa hora. Al tocar una sesión se abre su ficha, donde se cambia el estado o se marca como pagada.

**Ajustes › Google Calendar** publica las citas en un calendario del dispositivo. Si en el dispositivo está añadida la cuenta de Gmail de Teresa, el propio sistema las sube a su Google Calendar.
- El título es solo «Sesión · iniciales», como «Sesión · L. M.».
- Como lugar se pone la dirección de la consulta, u «Online» si la sesión es online.
- Se publican las citas de los últimos 30 días y de los próximos 180.
- Las canceladas se quitan del calendario.
- Conviene activarlo en un solo dispositivo, porque si lo publican dos, las citas salen repetidas.

Además, el calendario de la app muestra en gris los otros compromisos del calendario del dispositivo, para no dar citas encima. Se puede desactivar en Ajustes.
