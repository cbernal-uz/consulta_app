/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copiasSobrantes, cuerpoMultipart, tocaCopiaHoy } from '../copiaDiaria.ts';

test('una copia al día', () => {
  const ahora = new Date(2026, 9, 21, 9, 0);
  assert.equal(tocaCopiaHoy(null, ahora), true);
  assert.equal(tocaCopiaHoy(new Date(2026, 9, 21, 8, 0).toISOString(), ahora), false);
  assert.equal(tocaCopiaHoy(new Date(2026, 9, 20, 23, 59).toISOString(), ahora), true);
});

test('borra solo las copias más antiguas', () => {
  const archivos = ['2026-10-01', '2026-10-03', '2026-10-02', '2026-10-04'].map(d => ({ id: d, createdTime: `${d}T08:00:00Z` }));
  assert.deepEqual(copiasSobrantes(archivos, 2).map(a => a.id), ['2026-10-01', '2026-10-02']);
  assert.deepEqual(copiasSobrantes(archivos, 30), []);
});

test('el cuerpo multipart separa metadatos y contenido', () => {
  const c = cuerpoMultipart({ name: 'a.json' }, '{"x":1}', 'L');
  assert.equal(c, '--L\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"a.json"}\r\n--L\r\nContent-Type: application/json\r\n\r\n{"x":1}\r\n--L--\r\n');
});
