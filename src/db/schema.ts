import type { SQLiteDatabase } from 'expo-sqlite';

// Cada tabla lleva id de texto y updated_at para poder sincronizar más adelante con Supabase.
const MIGRACIONES: string[] = [
  `
  CREATE TABLE terapeuta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nombre TEXT NOT NULL DEFAULT '',
    nif TEXT NOT NULL DEFAULT '',
    direccion TEXT NOT NULL DEFAULT '',
    colegiado TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    serie_factura TEXT NOT NULL DEFAULT '2026-',
    siguiente_numero INTEGER NOT NULL DEFAULT 1,
    retencion_empresa_pct REAL NOT NULL DEFAULT 15
  );
  INSERT INTO terapeuta (id) VALUES (1);

  CREATE TABLE pacientes (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    precio_centimos INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('particular', 'empresa')),
    fiscal_nombre TEXT NOT NULL DEFAULT '',
    fiscal_nif TEXT NOT NULL DEFAULT '',
    fiscal_direccion TEXT NOT NULL DEFAULT '',
    activo INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE facturas (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL UNIQUE,
    paciente_id TEXT NOT NULL REFERENCES pacientes(id),
    fecha TEXT NOT NULL,
    periodo TEXT NOT NULL,
    emisor_json TEXT NOT NULL,   -- copia de los datos fiscales al emitir
    receptor_json TEXT NOT NULL,
    base_centimos INTEGER NOT NULL,
    retencion_pct REAL NOT NULL,
    retencion_centimos INTEGER NOT NULL,
    total_centimos INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'emitida',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE citas (
    id TEXT PRIMARY KEY,
    paciente_id TEXT NOT NULL REFERENCES pacientes(id),
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    duracion_min INTEGER NOT NULL DEFAULT 50,
    modalidad TEXT NOT NULL DEFAULT 'presencial',
    precio_centimos INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'programada',
    pagada INTEGER NOT NULL DEFAULT 0,
    metodo_pago TEXT,
    fecha_pago TEXT,
    factura_id TEXT REFERENCES facturas(id),
    updated_at TEXT NOT NULL
  );
  CREATE INDEX citas_fecha ON citas(fecha);

  CREATE TABLE lineas_factura (
    id TEXT PRIMARY KEY,
    factura_id TEXT NOT NULL REFERENCES facturas(id),
    cita_id TEXT NOT NULL REFERENCES citas(id),
    fecha TEXT NOT NULL,
    hora TEXT NOT NULL,
    duracion_min INTEGER NOT NULL,
    concepto TEXT NOT NULL,
    importe_centimos INTEGER NOT NULL
  );
  `,
];

export async function migrar(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = fila?.user_version ?? 0;
  while (version < MIGRACIONES.length) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRACIONES[version]);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
