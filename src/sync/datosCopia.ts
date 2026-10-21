import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLAS_COPIA, crearCopia, validarCopia, type Copia, type TablaCopia } from '../domain/copia';
import { esCopiaCifrada, type CopiaCifrada } from '../domain/cifrado';

// Lo común a la app y a la web: leer los datos para la copia, interpretar un archivo y restaurarlo.

export async function leerCopiaLocal(db: SQLiteDatabase): Promise<Copia> {
  const tablas = {} as Record<TablaCopia, Record<string, unknown>[]>;
  for (const t of TABLAS_COPIA) tablas[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  return crearCopia(tablas, new Date());
}

/** Las copias cifradas se devuelven sin descifrar. */
export function interpretarCopia(texto: string): Copia | CopiaCifrada {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es una copia de seguridad de Consulta.');
  }
  return esCopiaCifrada(datos) ? datos : validarCopia(datos);
}

/** Sustituye todos los datos del dispositivo por los de la copia. Quedan marcados para subir a Supabase. */
export async function restaurarCopia(db: SQLiteDatabase, copia: Copia): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLAS_COPIA].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLAS_COPIA) {
      const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
      const cols = info.map(i => i.name).filter(n => n !== 'pendiente');
      const sql = `INSERT INTO ${t} (${cols.join(', ')}, pendiente) VALUES (${cols.map(() => '?').join(', ')}, 1)`;
      for (const f of copia.tablas[t]) await db.runAsync(sql, ...cols.map(c => (f[c] ?? defecto(c)) as string | number | null));
    }
  });
}

// Copias hechas antes de que existiera una columna: valores por defecto razonables.
const defecto = (col: string) => (col === 'updated_at' ? new Date().toISOString() : col === 'sin_factura' ? 0 : null);
