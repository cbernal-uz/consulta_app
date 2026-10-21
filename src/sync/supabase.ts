import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { TABLAS_SINCRONIZADAS } from '../db/schema';
import { sqlAplicarRemota } from '../db/sqlSincronizacion';
import { guardarConfig, leerConfig } from './config';

// Sincronización con Supabase: primero baja lo que ha cambiado en el servidor y luego sube lo pendiente.
// Si la misma fila cambió en las dos tablets, gana el cambio más reciente (updated_at).

type Tabla = (typeof TABLAS_SINCRONIZADAS)[number];
type Fila = Record<string, unknown>;

let cliente: { clave: string; c: SupabaseClient } | null = null;

export async function clienteSupabase(db: SQLiteDatabase): Promise<SupabaseClient | null> {
  const url = await leerConfig(db, 'supabase_url');
  const key = await leerConfig(db, 'supabase_key');
  if (!url || !key) return null;
  if (cliente?.clave !== url + key) {
    cliente = {
      clave: url + key,
      // En la web la sesión se guarda en el localStorage del navegador, que es lo que usa Supabase por defecto.
      c: createClient(url, key, { auth: { storage: Platform.OS === 'web' ? undefined : Storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }),
    };
  }
  return cliente.c;
}

export async function conectar(db: SQLiteDatabase, url: string, key: string, email: string, password: string): Promise<void> {
  await guardarConfig(db, 'supabase_url', url.trim().replace(/\/+$/, ''));
  await guardarConfig(db, 'supabase_key', key.trim());
  const c = await clienteSupabase(db);
  const { error } = await c!.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
}

export async function desconectar(db: SQLiteDatabase): Promise<void> {
  const c = await clienteSupabase(db);
  await c?.auth.signOut();
}

export async function usuarioConectado(db: SQLiteDatabase): Promise<string | null> {
  const c = await clienteSupabase(db);
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user.email ?? null;
}

const columnas = new Map<Tabla, string[]>();
async function columnasLocales(db: SQLiteDatabase, t: Tabla): Promise<string[]> {
  if (!columnas.has(t)) {
    const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`);
    columnas.set(t, info.map(i => i.name).filter(n => n !== 'pendiente'));
  }
  return columnas.get(t)!;
}

async function bajar(db: SQLiteDatabase, c: SupabaseClient, t: Tabla): Promise<number> {
  const cols = await columnasLocales(db, t);
  const cursor = await leerConfig(db, `cursor_${t}`);
  // Un minuto de margen por si una escritura del servidor terminó tarde; volver a aplicar una fila no cambia nada.
  const desde = cursor ? new Date(Date.parse(cursor) - 60_000).toISOString() : '1970-01-01T00:00:00Z';
  const sql = sqlAplicarRemota(t, cols);
  let total = 0;
  let maximo = cursor;
  for (let desdeFila = 0; ; desdeFila += 1000) {
    const { data, error } = await c.from(t).select('*').gt('modificado', desde).order('modificado').range(desdeFila, desdeFila + 999);
    if (error) throw new Error(`No se pudo bajar ${t}: ${error.message}`);
    const filas = (data ?? []) as Fila[];
    await db.withTransactionAsync(async () => {
      for (const f of filas) await db.runAsync(sql, ...cols.map(x => (f[x] ?? null) as string | number | null));
    });
    total += filas.length;
    if (filas.length) maximo = String(filas[filas.length - 1].modificado);
    if (filas.length < 1000) break;
  }
  await db.runAsync(`UPDATE ${t} SET pendiente = 0 WHERE pendiente = -1`);
  if (maximo) await guardarConfig(db, `cursor_${t}`, maximo);
  return total;
}

async function subir(db: SQLiteDatabase, c: SupabaseClient, t: Tabla): Promise<number> {
  const cols = await columnasLocales(db, t);
  const filas = await db.getAllAsync<Fila>(`SELECT ${cols.join(', ')} FROM ${t} WHERE pendiente = 1`);
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const { error } = await c.from(t).upsert(lote, { onConflict: 'id' });
    if (error) throw new Error(`No se pudo subir ${t}: ${error.message}`);
    // Solo se da por subida si no ha vuelto a cambiar mientras tanto.
    for (const f of lote) {
      await db.runAsync(`UPDATE ${t} SET pendiente = 0 WHERE id = ? AND updated_at = ? AND pendiente = 1`, f.id as string, f.updated_at as string);
    }
  }
  return filas.length;
}

let enCurso: Promise<{ bajadas: number; subidas: number }> | null = null;

/** Devuelve null si la sincronización no está configurada o no hay sesión iniciada. */
export async function sincronizar(db: SQLiteDatabase): Promise<{ bajadas: number; subidas: number } | null> {
  const c = await clienteSupabase(db);
  if (!c || !(await c.auth.getSession()).data.session) return null;
  enCurso ??= (async () => {
    try {
      let bajadas = 0;
      let subidas = 0;
      for (const t of TABLAS_SINCRONIZADAS) bajadas += await bajar(db, c, t);
      for (const t of TABLAS_SINCRONIZADAS) subidas += await subir(db, c, t);
      await guardarConfig(db, 'ultima_sincronizacion', new Date().toISOString());
      await guardarConfig(db, 'error_sincronizacion', null);
      return { bajadas, subidas };
    } catch (e) {
      await guardarConfig(db, 'error_sincronizacion', e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

export async function pendientesDeSubir(db: SQLiteDatabase): Promise<number> {
  let n = 0;
  for (const t of TABLAS_SINCRONIZADAS) {
    n += (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t} WHERE pendiente = 1`))?.n ?? 0;
  }
  return n;
}
