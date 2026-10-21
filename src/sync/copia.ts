import type { SQLiteDatabase } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getRandomBytes } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { nombreCopia, type Copia } from '../domain/copia';
import { cifrarCopia, type CopiaCifrada } from '../domain/cifrado';
import { guardarConfig } from './config';
import { interpretarCopia, leerCopiaLocal } from './datosCopia';

export { leerCopiaLocal, restaurarCopia } from './datosCopia';

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
  return interpretarCopia(await new File(r.assets[0].uri).text());
}
