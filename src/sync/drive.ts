import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytes } from 'expo-crypto';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { cifrarCopia } from '../domain/cifrado';
import { nombreCopia } from '../domain/copia';
import { copiasSobrantes, cuerpoMultipart, tocaCopiaHoy } from '../domain/copiaDiaria';
import { guardarConfig, leerConfig } from './config';
import { leerCopiaLocal } from './copia';

// Copia automática: una vez al día, al abrir la app, sube la copia cifrada a una carpeta de Google Drive.
// Con el permiso drive.file la app solo puede ver los archivos que ella misma ha creado.

const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
const CARPETA = 'Consulta - copias de seguridad';
const CLAVE_CONTRASENA = 'contrasena_copia_auto';

async function configurar(db: SQLiteDatabase) {
  const iosClientId = (await leerConfig(db, 'google_ios_client_id')) ?? undefined;
  if (Platform.OS === 'ios' && !iosClientId) throw new Error('Falta el ID de cliente de iOS de Google.');
  GoogleSignin.configure({ scopes: ['https://www.googleapis.com/auth/drive.file'], iosClientId });
}

export async function conectarGoogle(db: SQLiteDatabase): Promise<string | null> {
  await configurar(db);
  await GoogleSignin.hasPlayServices();
  const r = await GoogleSignin.signIn();
  if (!isSuccessResponse(r)) return null;
  await guardarConfig(db, 'google_email', r.data.user.email);
  return r.data.user.email;
}

export async function desconectarGoogle(db: SQLiteDatabase): Promise<void> {
  await configurar(db).catch(() => {});
  await GoogleSignin.signOut().catch(() => {});
  await guardarConfig(db, 'google_email', null);
  await guardarConfig(db, 'drive_carpeta', null);
}

export const guardarContrasenaAuto = (contrasena: string) => SecureStore.setItemAsync(CLAVE_CONTRASENA, contrasena);
export const hayContrasenaAuto = async () => !!(await SecureStore.getItemAsync(CLAVE_CONTRASENA));

async function token(db: SQLiteDatabase): Promise<string> {
  await configurar(db);
  const r = await GoogleSignin.signInSilently();
  if (r.type !== 'success') throw new Error('La sesión de Google ha caducado. Vuelve a conectar Google en Ajustes.');
  return (await GoogleSignin.getTokens()).accessToken;
}

async function pedir(t: string, url: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...init.headers } });
  if (!r.ok && r.status !== 404) throw new Error(`Google Drive respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function carpeta(db: SQLiteDatabase, t: string): Promise<string> {
  const guardada = await leerConfig(db, 'drive_carpeta');
  if (guardada) {
    const r = await pedir(t, `${API}/files/${guardada}?fields=id,trashed`);
    if (r.ok && !(await r.json()).trashed) return guardada;
  }
  const r = await pedir(t, `${API}/files?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: CARPETA, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const { id } = (await r.json()) as { id: string };
  await guardarConfig(db, 'drive_carpeta', id);
  return id;
}

/** Sube una copia cifrada ahora y borra las que sobran. */
export async function subirCopiaADrive(db: SQLiteDatabase): Promise<void> {
  const contrasena = await SecureStore.getItemAsync(CLAVE_CONTRASENA);
  if (!contrasena) throw new Error('Falta la contraseña de la copia automática.');
  const t = await token(db);
  const dir = await carpeta(db, t);
  const copia = await leerCopiaLocal(db);
  const cifrada = await cifrarCopia(copia, contrasena, getRandomBytes);
  const limite = `consulta${Date.now()}`;
  await pedir(t, SUBIDA, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` },
    body: cuerpoMultipart({ name: nombreCopia(new Date(copia.creada)), parents: [dir], mimeType: 'application/json' }, JSON.stringify(cifrada), limite),
  });
  const q = encodeURIComponent(`'${dir}' in parents and trashed = false`);
  const lista = await pedir(t, `${API}/files?q=${q}&fields=files(id,createdTime)&pageSize=200`);
  const { files } = (await lista.json()) as { files: { id: string; createdTime: string }[] };
  for (const f of copiasSobrantes(files)) await pedir(t, `${API}/files/${f.id}`, { method: 'DELETE' });
  await guardarConfig(db, 'ultima_copia_auto', copia.creada);
  await guardarConfig(db, 'ultima_copia', copia.creada);
  await guardarConfig(db, 'error_copia_auto', null);
}

let enCurso = false;

/** Se llama al abrir la app: hace la copia del día si está activada y aún no se ha hecho. */
export async function copiaAutomatica(db: SQLiteDatabase): Promise<void> {
  if (enCurso || (await leerConfig(db, 'copia_auto')) !== '1') return;
  if (!tocaCopiaHoy(await leerConfig(db, 'ultima_copia_auto'), new Date())) return;
  enCurso = true;
  try {
    await subirCopiaADrive(db);
  } catch (e) {
    await guardarConfig(db, 'error_copia_auto', e instanceof Error ? e.message : String(e));
  } finally {
    enCurso = false;
  }
}
