import type { SQLiteDatabase } from 'expo-sqlite';
import type { BorradorFactura, Cita, EstadoCita, Paciente, Terapeuta } from '../domain/types.ts';
import { esCobrable, numeroFactura, serieParaFecha } from '../domain/reglas.ts';
import type { FacturaEmitida, IngresoSinFactura } from '../domain/trimestre.ts';

export function nuevoId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ahora = () => new Date().toISOString();

type FilaPaciente = {
  id: string; nombre: string; email: string; telefono: string; precio_centimos: number; tipo: Paciente['tipo'];
  fiscal_nombre: string; fiscal_nif: string; fiscal_direccion: string; activo: number;
  sin_factura: number;
};

type FilaCita = {
  id: string; paciente_id: string; fecha: string; hora: string; duracion_min: number; modalidad: Cita['modalidad'];
  precio_centimos: number; estado: EstadoCita; pagada: number; metodo_pago: string | null; fecha_pago: string | null;
  factura_id: string | null;
};

const aPaciente = (f: FilaPaciente): Paciente => ({
  id: f.id, nombre: f.nombre, email: f.email, telefono: f.telefono, precioCentimos: f.precio_centimos, tipo: f.tipo,
  fiscal: { nombre: f.fiscal_nombre, nif: f.fiscal_nif, direccion: f.fiscal_direccion }, activo: f.activo === 1,
  sinFactura: f.sin_factura === 1,
});

const aCita = (f: FilaCita): Cita => ({
  id: f.id, pacienteId: f.paciente_id, fecha: f.fecha, hora: f.hora, duracionMin: f.duracion_min, modalidad: f.modalidad,
  precioCentimos: f.precio_centimos, estado: f.estado, pagada: f.pagada === 1, metodoPago: f.metodo_pago,
  fechaPago: f.fecha_pago, facturaId: f.factura_id,
});

export async function leerTerapeuta(db: SQLiteDatabase): Promise<Terapeuta> {
  const f = await db.getFirstAsync<Record<string, string | number>>('SELECT * FROM terapeuta WHERE id = 1');
  return {
    nombre: String(f?.nombre ?? ''), nif: String(f?.nif ?? ''), direccion: String(f?.direccion ?? ''),
    colegiado: String(f?.colegiado ?? ''), email: String(f?.email ?? ''), serieFactura: String(f?.serie_factura ?? '2026-'),
    siguienteNumero: Number(f?.siguiente_numero ?? 1), retencionEmpresaPct: Number(f?.retencion_empresa_pct ?? 15),
  };
}

export async function guardarTerapeuta(db: SQLiteDatabase, t: Terapeuta): Promise<void> {
  await db.runAsync(
    `UPDATE terapeuta SET nombre = ?, nif = ?, direccion = ?, colegiado = ?, email = ?, serie_factura = ?,
       siguiente_numero = ?, retencion_empresa_pct = ? WHERE id = 1`,
    t.nombre, t.nif, t.direccion, t.colegiado, t.email, t.serieFactura, t.siguienteNumero, t.retencionEmpresaPct,
  );
}

export async function listarPacientes(db: SQLiteDatabase): Promise<Paciente[]> {
  const filas = await db.getAllAsync<FilaPaciente>('SELECT * FROM pacientes ORDER BY activo DESC, nombre');
  return filas.map(aPaciente);
}

export async function guardarPaciente(db: SQLiteDatabase, p: Paciente): Promise<void> {
  await db.runAsync(
    `INSERT INTO pacientes (id, nombre, email, telefono, precio_centimos, tipo, fiscal_nombre, fiscal_nif, fiscal_direccion, activo, sin_factura, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, email = excluded.email, telefono = excluded.telefono,
       precio_centimos = excluded.precio_centimos, tipo = excluded.tipo, fiscal_nombre = excluded.fiscal_nombre,
       fiscal_nif = excluded.fiscal_nif, fiscal_direccion = excluded.fiscal_direccion, activo = excluded.activo, sin_factura = excluded.sin_factura,
       updated_at = excluded.updated_at`,
    p.id, p.nombre, p.email, p.telefono, p.precioCentimos, p.tipo, p.fiscal.nombre || p.nombre, p.fiscal.nif,
    p.fiscal.direccion, p.activo ? 1 : 0, p.sinFactura ? 1 : 0, ahora(),
  );
  // El nuevo precio se aplica a las citas que aún no se han hecho.
  await db.runAsync(
    `UPDATE citas SET precio_centimos = ?, updated_at = ? WHERE paciente_id = ? AND estado = 'programada' AND factura_id IS NULL`,
    p.precioCentimos, ahora(), p.id,
  );
}

export async function listarCitas(db: SQLiteDatabase, desde: string, hasta: string): Promise<Cita[]> {
  const filas = await db.getAllAsync<FilaCita>(
    'SELECT * FROM citas WHERE fecha BETWEEN ? AND ? ORDER BY fecha, hora', desde, hasta,
  );
  return filas.map(aCita);
}

/** Sesiones que se cobran y no están pagadas, de la más antigua a la más reciente. */
export async function listarSinCobrar(db: SQLiteDatabase): Promise<Cita[]> {
  const filas = await db.getAllAsync<FilaCita>(
    `SELECT * FROM citas WHERE pagada = 0 AND estado IN ('realizada', 'cancelada_tarde', 'no_asistio') ORDER BY fecha, hora`,
  );
  return filas.map(aCita);
}

export async function crearCita(db: SQLiteDatabase, c: Omit<Cita, 'id'>): Promise<Cita> {
  const cita = { ...c, id: nuevoId() };
  await db.runAsync(
    `INSERT INTO citas (id, paciente_id, fecha, hora, duracion_min, modalidad, precio_centimos, estado, pagada, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    cita.id, cita.pacienteId, cita.fecha, cita.hora, cita.duracionMin, cita.modalidad, cita.precioCentimos,
    cita.estado, cita.pagada ? 1 : 0, ahora(),
  );
  return cita;
}

export async function cambiarEstado(db: SQLiteDatabase, id: string, estado: EstadoCita): Promise<void> {
  // Una sesión que deja de ser cobrable no puede seguir marcada como pagada.
  await db.runAsync(
    `UPDATE citas SET estado = ?, pagada = CASE WHEN ? THEN pagada ELSE 0 END, updated_at = ?
     WHERE id = ? AND factura_id IS NULL`,
    estado, esCobrable(estado) ? 1 : 0, ahora(), id,
  );
}

export async function marcarPago(db: SQLiteDatabase, id: string, pagada: boolean, metodo: string | null): Promise<void> {
  await db.runAsync(
    'UPDATE citas SET pagada = ?, metodo_pago = ?, fecha_pago = ?, updated_at = ? WHERE id = ?',
    pagada ? 1 : 0, pagada ? metodo : null, pagada ? ahora().slice(0, 10) : null, ahora(), id,
  );
}

/** Emite la factura de forma atómica: número correlativo, líneas y sesiones bloqueadas. */
export async function emitirFactura(db: SQLiteDatabase, b: BorradorFactura, paciente: Paciente): Promise<string> {
  if (b.lineas.length === 0) throw new Error('No hay sesiones por facturar');
  let numero = '';
  await db.withTransactionAsync(async () => {
    const t = await leerTerapeuta(db);
    const hoy = ahora().slice(0, 10);
    const { serie, siguiente } = serieParaFecha(t.serieFactura, t.siguienteNumero, hoy);
    numero = numeroFactura(serie, siguiente);
    const id = nuevoId();
    await db.runAsync(
      `INSERT INTO facturas (id, numero, paciente_id, fecha, periodo, emisor_json, receptor_json, base_centimos,
         retencion_pct, retencion_centimos, total_centimos, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, numero, paciente.id, hoy, b.periodo,
      JSON.stringify({ nombre: t.nombre, nif: t.nif, direccion: t.direccion, colegiado: t.colegiado }),
      JSON.stringify({ ...paciente.fiscal, paciente: paciente.nombre, tipo: paciente.tipo }),
      b.baseCentimos, b.retencionPct, b.retencionCentimos, b.totalCentimos, ahora(),
    );
    for (const l of b.lineas) {
      await db.runAsync(
        `INSERT INTO lineas_factura (id, factura_id, cita_id, fecha, hora, duracion_min, concepto, importe_centimos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        nuevoId(), id, l.citaId, l.fecha, l.hora, l.duracionMin, l.concepto, l.importeCentimos,
      );
      await db.runAsync('UPDATE citas SET factura_id = ?, updated_at = ? WHERE id = ?', id, ahora(), l.citaId);
    }
    await db.runAsync('UPDATE terapeuta SET serie_factura = ?, siguiente_numero = ? WHERE id = 1', serie, siguiente + 1);
  });
  return numero;
}

export async function listarFacturasEmitidas(db: SQLiteDatabase, desde: string, hasta: string): Promise<FacturaEmitida[]> {
  const filas = await db.getAllAsync<{
    numero: string; fecha: string; receptor_json: string; base_centimos: number; retencion_pct: number;
    retencion_centimos: number; total_centimos: number;
  }>('SELECT * FROM facturas WHERE fecha BETWEEN ? AND ? ORDER BY numero', desde, hasta);
  return filas.map(f => {
    const receptor = JSON.parse(f.receptor_json) as { nombre: string; nif: string };
    return {
      numero: f.numero, fecha: f.fecha, clienteNombre: receptor.nombre, clienteNif: receptor.nif,
      baseCentimos: f.base_centimos, retencionPct: f.retencion_pct, retencionCentimos: f.retencion_centimos,
      totalCentimos: f.total_centimos,
    };
  });
}

/** Sesiones cobradas en el periodo de pacientes a los que no se emite factura, agrupadas por paciente. */
export async function listarIngresosSinFactura(db: SQLiteDatabase, desde: string, hasta: string): Promise<IngresoSinFactura[]> {
  return db.getAllAsync<IngresoSinFactura>(
    `SELECT p.nombre AS paciente, COUNT(*) AS sesiones, SUM(c.precio_centimos) AS importeCentimos
     FROM citas c JOIN pacientes p ON p.id = c.paciente_id
     WHERE p.sin_factura = 1 AND c.pagada = 1 AND c.fecha BETWEEN ? AND ?
       AND c.estado IN ('realizada', 'cancelada_tarde', 'no_asistio')
     GROUP BY p.id ORDER BY p.nombre`,
    desde, hasta,
  );
}
