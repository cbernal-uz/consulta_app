/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenPorMes, resumenPorTrimestre, totalFilas } from '../resumen.ts';
import type { Cita, Paciente } from '../types.ts';

const pac = (id: string, over: Partial<Paciente> = {}): Paciente => ({
  id, nombre: id, email: '', telefono: '', precioCentimos: 6000, tipo: 'particular',
  fiscal: { nombre: id, nif: '', direccion: '' }, activo: true, sinFactura: false, ...over,
});
const cita = (pacienteId: string, fecha: string, over: Partial<Cita> = {}): Cita => ({
  id: fecha + pacienteId, pacienteId, fecha, hora: '10:00', duracionMin: 50, modalidad: 'presencial',
  precioCentimos: 6000, estado: 'realizada', pagada: true, metodoPago: null, fechaPago: null, facturaId: null, ...over,
});

test('el resumen separa con y sin factura, sin cobrar y retenciones', () => {
  const pacientes = [pac('a'), pac('e', { tipo: 'empresa' }), pac('s', { sinFactura: true })];
  const citas = [
    cita('a', '2026-09-07'), cita('a', '2026-09-14', { pagada: false }),
    cita('e', '2026-09-08', { precioCentimos: 7000 }),
    cita('s', '2026-09-09'), cita('s', '2026-10-02', { estado: 'cancelada_tarde', pagada: false }),
    cita('a', '2026-10-05', { estado: 'cancelada' }), cita('a', '2026-10-12', { estado: 'programada', pagada: false }),
  ];
  const meses = resumenPorMes(citas, pacientes, 15);
  assert.deepEqual(meses.map(m => m.clave), ['2026-09', '2026-10']);
  assert.deepEqual(meses[0], { clave: '2026-09', conFactura: 19000, sinFactura: 6000, total: 25000, cobrado: 19000, sinCobrar: 6000, retenciones: 1050, sesiones: 4 });
  assert.equal(meses[1].sinCobrar, 6000);
  const trim = resumenPorTrimestre(citas, pacientes, 15);
  assert.deepEqual(trim.map(t => t.clave), ['2026-T3', '2026-T4']);
  assert.equal(totalFilas(trim).total, 31000);
});
