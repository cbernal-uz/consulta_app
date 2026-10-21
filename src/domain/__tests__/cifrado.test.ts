/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { crearCopia } from '../copia.ts';
import { cifrarCopia, descifrarCopia, esCopiaCifrada } from '../cifrado.ts';

const copia = crearCopia({
  terapeuta: [{ id: 1 }], pacientes: [{ id: 'p1', nombre: 'Lucía Martín' }], facturas: [], citas: [], lineas_factura: [],
}, new Date('2026-10-21T20:00:00Z'));
const aleatorio = (n: number) => new Uint8Array(randomBytes(n));

test('la copia cifrada no deja ver los datos y se recupera con la contraseña', async () => {
  const c = JSON.parse(JSON.stringify(await cifrarCopia(copia, 'sagasta-72-izda', aleatorio)));
  assert.ok(esCopiaCifrada(c));
  assert.doesNotMatch(JSON.stringify(c), /Lucía|Martín|p1/);
  assert.deepEqual(await descifrarCopia(c, 'sagasta-72-izda'), copia);
});

test('una contraseña incorrecta o corta da un error claro', async () => {
  const c = await cifrarCopia(copia, 'sagasta-72-izda', aleatorio);
  await assert.rejects(descifrarCopia(c, 'otra-contraseña'), /Contraseña incorrecta/);
  await assert.rejects(cifrarCopia(copia, 'corta', aleatorio), /al menos 8/);
});
