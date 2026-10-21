import type { SQLiteDatabase } from 'expo-sqlite';

/** En este orden se suben y se bajan, para respetar las referencias entre tablas. */
export const TABLAS_SINCRONIZADAS = ['terapeuta', 'pacientes', 'facturas', 'citas', 'lineas_factura'] as const;

// Cada tabla lleva id de texto y updated_at para poder sincronizar más adelante con Supabase.
export const MIGRACIONES: string[] = [
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
  INSERT INTO terapeuta (id, nombre, direccion, colegiado) VALUES (1, 'Teresa Lorente Casaus', 'Paseo de Sagasta 72, 3º Izda, 50006 Zaragoza', 'A-02051');

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
  `ALTER TABLE pacientes ADD COLUMN sin_factura INTEGER NOT NULL DEFAULT 0;`,
  // Sincronización: «pendiente» = 1 si la fila tiene cambios sin subir, -1 mientras se baja de Supabase.
  `
  ALTER TABLE terapeuta ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  ALTER TABLE lineas_factura ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
  CREATE TABLE config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  ${TABLAS_SINCRONIZADAS.map(t => `
  ALTER TABLE ${t} ADD COLUMN pendiente INTEGER NOT NULL DEFAULT 1;
  CREATE TRIGGER ${t}_pendiente AFTER UPDATE ON ${t} WHEN NEW.pendiente = OLD.pendiente AND NEW.pendiente <> 1
  BEGIN UPDATE ${t} SET pendiente = 1 WHERE rowid = NEW.rowid; END;`).join('')}
  `,
  // Eventos publicados en Google Calendar desde este dispositivo. No se sincroniza: cada id es local del dispositivo.
  `CREATE TABLE eventos_calendario (cita_id TEXT PRIMARY KEY, evento_id TEXT NOT NULL, firma TEXT NOT NULL);`,
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
