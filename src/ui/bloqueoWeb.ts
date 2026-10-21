import type { SQLiteDatabase } from 'expo-sqlite';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { guardarConfig, leerConfig } from '../sync/config';

// Bloqueo de la versión web: una contraseña de este dispositivo y, si se quiere, Face ID o huella con una passkey.
// Como en la app, solo tapa la pantalla: los datos siguen en el navegador de este dispositivo.

const KDF = { N: 2 ** 14, r: 8, p: 1, dkLen: 32 } as const;
const aBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deBase64 = (s: string) => new Uint8Array([...atob(s)].map(c => c.charCodeAt(0)));
const azar = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function guardarClaveBloqueo(db: SQLiteDatabase, clave: string): Promise<void> {
  const sal = azar(16);
  const hash = await scryptAsync(clave.normalize('NFC'), sal, KDF);
  await guardarConfig(db, 'bloqueo_clave', JSON.stringify({ sal: aBase64(sal), hash: aBase64(hash) }));
  await guardarConfig(db, 'bloqueo', '1');
}

export async function comprobarClaveBloqueo(db: SQLiteDatabase, clave: string): Promise<boolean> {
  const guardada = await leerConfig(db, 'bloqueo_clave');
  if (!guardada) return true;
  const { sal, hash } = JSON.parse(guardada) as { sal: string; hash: string };
  const calculado = aBase64(await scryptAsync(clave.normalize('NFC'), deBase64(sal), KDF));
  return calculado === hash;
}

export async function bloqueoActivo(db: SQLiteDatabase): Promise<boolean> {
  return (await leerConfig(db, 'bloqueo')) !== '0' && !!(await leerConfig(db, 'bloqueo_clave'));
}

export const hayPasskeys = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

/**
 * Crea una passkey en este dispositivo (Face ID, Touch ID, huella o Windows Hello).
 * navigator.credentials.create se llama antes de cualquier await: Safari solo lo permite justo al pulsar un botón.
 */
export async function crearPasskey(db: SQLiteDatabase): Promise<void> {
  const creada = navigator.credentials.create({
    publicKey: {
      rp: { name: 'Consulta' },
      user: { id: azar(16), name: 'Consulta', displayName: 'Consulta' },
      challenge: azar(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  });
  const c = (await creada) as PublicKeyCredential | null;
  if (!c) throw new Error('No se pudo activar Face ID o la huella.');
  await guardarConfig(db, 'bloqueo_passkey', aBase64(new Uint8Array(c.rawId)));
}

/** Pide Face ID o la huella. Igual que crearPasskey, hay que llamarla directamente al pulsar. */
export async function verificarPasskey(id: string): Promise<boolean> {
  const c = (await navigator.credentials.get({
    publicKey: {
      challenge: azar(32),
      allowCredentials: [{ type: 'public-key', id: deBase64(id) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!c) return false;
  // El bit UV de authenticatorData indica que el dispositivo comprobó a la persona (Face ID, huella o código).
  const datos = new Uint8Array((c.response as AuthenticatorAssertionResponse).authenticatorData);
  return (datos[32] & 0x04) !== 0;
}
