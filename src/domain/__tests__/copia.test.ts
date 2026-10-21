/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCopia, nombreCopia, resumenCopia, validarCopia } from '../copia.ts';

const tablas = {
  terapeuta: [{ id: 1, nombre: 'Teresa' }], pacientes: [{ id: 'p1' }, { id: 'p2' }],
  facturas: [{ id: 'f1' }], citas: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }], lineas_factura: [],
};

test('una copia se puede leer de vuelta tras pasar por JSON', () => {
  const c = validarCopia(JSON.parse(JSON.stringify(crearCopia(tablas, new Date('2026-10-21T20:05:00Z')))));
  assert.equal(c.creada, '2026-10-21T20:05:00.000Z');
  assert.equal(resumenCopia(c), '2 pacientes, 3 sesiones y 1 facturas');
});

test('rechaza archivos que no son una copia completa', () => {
  assert.throws(() => validarCopia({ hola: 1 }), /no es una copia/);
  assert.throws(() => validarCopia({ ...crearCopia(tablas, new Date()), version: 2 }), /versión/);
  const { citas: _, ...sinCitas } = tablas;
  assert.throws(() => validarCopia({ app: 'consulta', version: 1, creada: '', tablas: sinCitas }), /citas/);
});

test('el nombre del archivo lleva fecha y hora', () => {
  assert.equal(nombreCopia(new Date(2026, 9, 21, 9, 5)), 'Consulta copia 2026-10-21 0905.json');
});
