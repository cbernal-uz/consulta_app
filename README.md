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

## Dónde se guardan los datos

En cada tablet, en una base de datos SQLite (`consulta.db`) dentro del espacio privado de la app. Si se configura Supabase, se copian también en vuestro proyecto de Supabase, que es lo que mantiene las dos tablets iguales.

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

**Ajustes › Copia de seguridad › Guardar copia en Google Drive** crea un archivo `Consulta copia AAAA-MM-DD HHMM.json` con todos los datos y abre el menú de compartir. Ahí se elige Drive y la carpeta. La app avisa si pasa más de una semana sin copia.

**Restaurar una copia** permite elegir el archivo, también desde Drive, y muestra cuántos pacientes, sesiones y facturas contiene antes de sustituir los datos. Lo restaurado se envía a la otra tablet en la siguiente sincronización.
