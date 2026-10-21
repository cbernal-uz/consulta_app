import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { validarCopia, type Copia } from './copia.ts';

// Copia cifrada con AES-256-GCM. La clave sale de la contraseña con scrypt; sin ella el archivo es ilegible.

// N = 2^14: en una tablet (Hermes, sin JIT) tarda unos segundos, que es aceptable para una copia.
const KDF = { N: 2 ** 14, r: 8, p: 1 } as const;
const AAD = new TextEncoder().encode('consulta-copia-v2');
export const MIN_CONTRASENA = 8;

export interface CopiaCifrada {
  app: 'consulta';
  version: 2;
  creada: string;
  cifrado: { alg: 'AES-256-GCM'; kdf: 'scrypt'; N: number; r: number; p: number; sal: string; iv: string };
  datos: string; // base64
}

const aBase64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const deBase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const clave = (contrasena: string, sal: Uint8Array, k: { N: number; r: number; p: number }) =>
  scryptAsync(contrasena.normalize('NFC'), sal, { ...k, dkLen: 32 });

export function esCopiaCifrada(datos: unknown): datos is CopiaCifrada {
  const c = datos as Partial<CopiaCifrada> | null;
  return !!c && c.app === 'consulta' && c.version === 2 && typeof c.datos === 'string' && !!c.cifrado;
}

/** `aleatorio` da bytes aleatorios seguros (expo-crypto en la app, node:crypto en los tests). */
export async function cifrarCopia(copia: Copia, contrasena: string, aleatorio: (n: number) => Uint8Array): Promise<CopiaCifrada> {
  if (contrasena.length < MIN_CONTRASENA) throw new Error(`La contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.`);
  const sal = aleatorio(16);
  const iv = aleatorio(12);
  const k = await clave(contrasena, sal, KDF);
  const datos = gcm(k, iv, AAD).encrypt(new TextEncoder().encode(JSON.stringify(copia)));
  return {
    app: 'consulta', version: 2, creada: copia.creada,
    cifrado: { alg: 'AES-256-GCM', kdf: 'scrypt', ...KDF, sal: aBase64(sal), iv: aBase64(iv) },
    datos: aBase64(datos),
  };
}

export async function descifrarCopia(c: CopiaCifrada, contrasena: string): Promise<Copia> {
  const { N, r, p, sal, iv } = c.cifrado;
  const k = await clave(contrasena, deBase64(sal), { N, r, p });
  let claro: Uint8Array;
  try {
    claro = gcm(k, deBase64(iv), AAD).decrypt(deBase64(c.datos));
  } catch {
    throw new Error('Contraseña incorrecta o archivo dañado.');
  }
  return validarCopia(JSON.parse(new TextDecoder().decode(claro)));
}
