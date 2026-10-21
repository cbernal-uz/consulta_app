import type { SQLiteDatabase } from 'expo-sqlite';
import { getRandomBytes } from 'expo-crypto';
import { nombreCopia, type Copia } from '../domain/copia';
import { cifrarCopia, type CopiaCifrada } from '../domain/cifrado';
import { guardarConfig } from './config';
import { interpretarCopia, leerCopiaLocal } from './datosCopia';

export { leerCopiaLocal, restaurarCopia } from './datosCopia';

/** Cifra todos los datos con la contraseña y descarga el archivo. En el iPhone queda en Archivos › Descargas. */
export async function guardarCopia(db: SQLiteDatabase, contrasena: string): Promise<void> {
  const copia = await leerCopiaLocal(db);
  const cifrada = await cifrarCopia(copia, contrasena, getRandomBytes);
  const url = URL.createObjectURL(new Blob([JSON.stringify(cifrada)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreCopia(new Date(copia.creada));
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  await guardarConfig(db, 'ultima_copia', copia.creada);
}

/** Abre el selector de archivos del navegador. Tiene que llamarse directamente al pulsar un botón. */
export function elegirCopia(): Promise<Copia | CopiaCifrada | null> {
  return new Promise((resolver, fallar) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const archivo = input.files?.[0];
      if (!archivo) return resolver(null);
      try { resolver(interpretarCopia(await archivo.text())); } catch (e) { fallar(e); }
    };
    input.addEventListener('cancel', () => resolver(null));
    input.click();
  });
}
