import type { SQLiteDatabase } from 'expo-sqlite';

// Ajustes técnicos guardados en la tabla config del propio dispositivo.

export async function leerConfig(db: SQLiteDatabase, clave: string): Promise<string | null> {
  const f = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE clave = ?', clave);
  return f?.valor ?? null;
}

export async function guardarConfig(db: SQLiteDatabase, clave: string, valor: string | null): Promise<void> {
  if (valor === null) await db.runAsync('DELETE FROM config WHERE clave = ?', clave);
  else await db.runAsync('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', clave, valor);
}
