# Consulta

App móvil (iPhone y Android) para gestionar las citas y la facturación de una consulta de psicología con un único terapeuta.

## Qué hace esta versión

- **Sesiones:** lista semanal de citas. Cada sesión se marca como programada, realizada, cancelada a tiempo, cancelada con menos de 24 h o no asistida, y como pagada o pendiente.
- **Nueva cita:** crea la cita y abre WhatsApp o el email con el aviso ya escrito para el paciente.
- **Pacientes:** alta y edición, con precio por sesión y datos de facturación (particular o empresa).
- **Facturas:** reúne las sesiones cobrables y sin facturar de un paciente en un mes y emite la factura con número correlativo. Aplica la exención de IVA y, a empresas, la retención de IRPF.
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
