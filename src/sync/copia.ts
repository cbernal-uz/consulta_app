import type { SQLiteDatabase } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getRandomBytes } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { TABLAS_COPIA, crearCopia, nombreCopia, validarCopia, type Copia, type TablaCopia } from '../domain/copia';
import { cifrarCopia, esCopiaCifrada, type CopiaCifrada } from '../domain/cifrado';
import { guardarConfig } from './config';

export async function leerCopiaLocal(db: SQLiteDatabase): Promise<Copia> {
  const tablas = {} as Record<TablaCopia, Record<string, unknown>[]>;
  for (const t of TABLAS_COPIA) tablas[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  return crearCopia(tablas, new Date());
}

/** Cifra todos los datos con la contraseña y abre el menú de compartir para guardarlo en Google Drive. */
export async function guardarCopia(db: SQLiteDatabase, contrasena: string): Promise<void> {
  const copia = await leerCopiaLocal(db);
  const cifrada = await cifrarCopia(copia, contrasena, getRandomBytes);
  const archivo = new File(Paths.cache, nombreCopia(new Date(copia.creada)));
  if (archivo.exists) archivo.delete();
  archivo.create();
  await archivo.write(JSON.stringify(cifrada));
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/json', dialogTitle: 'Guardar copia en Google Drive' });
  await guardarConfig(db, 'ultima_copia', copia.creada);
}

/** Abre el selector de archivos (incluido Google Drive). Las copias cifradas se devuelven sin descifrar. */
export async function elegirCopia(): Promise<Copia | CopiaCifrada | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return null;
  const texto = await new File(r.assets[0].uri).text();
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
