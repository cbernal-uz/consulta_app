import type { SQLiteDatabase } from 'expo-sqlite';

// En la web no hay copia automática en Google Drive: la hace la tablet, que tiene la app instalada.
// Iniciar sesión con Google desde la web solo da permiso durante una hora y no puede renovarse sola.

const SOLO_TABLET = 'La copia automática en Google Drive se activa en la tablet.';

export async function conectarGoogle(_db: SQLiteDatabase): Promise<string | null> {
  throw new Error(SOLO_TABLET);
}
export async function desconectarGoogle(_db: SQLiteDatabase): Promise<void> {}
export async function guardarContrasenaAuto(_contrasena: string): Promise<void> {
  throw new Error(SOLO_TABLET);
}
export const hayContrasenaAuto = async () => false;
export async function subirCopiaADrive(_db: SQLiteDatabase): Promise<void> {
  throw new Error(SOLO_TABLET);
}
export async function copiaAutomatica(_db: SQLiteDatabase): Promise<void> {}
