/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aspectoCita, celdasMes, datosEvento, firmaEvento, horaEnPunto, iniciales, planPublicacion, posicion, semanaDe } from '../calendario.ts';
import type { Cita, Paciente, Terapeuta } from '../types.ts';

const paciente: Paciente = {
  id: 'p1', nombre: 'Lucía Martín Sanz', email: '', telefono: '', precioCentimos: 6000, tipo: 'particular',
  fiscal: { nombre: '', nif: '', direccion: '' }, activo: true, sinFactura: false,
};
const terapeuta = { direccion: 'Paseo de Sagasta 72, 3º Izda, 50006 Zaragoza' } as Terapeuta;
const cita = (over: Partial<Cita> = {}): Cita => ({
  id: 'c1', pacienteId: 'p1', fecha: '2026-10-28', hora: '10:00', duracionMin: 50, modalidad: 'presencial', precioCentimos: 6000,
  estado: 'programada', pagada: false, metodoPago: null, fechaPago: null, facturaId: null, ...over,
});

test('las pagadas se pintan como pagadas y el resto según su estado', () => {
  assert.equal(aspectoCita(cita()), 'programada');
  assert.equal(aspectoCita(cita({ estado: 'realizada', pagada: true })), 'pagada');
  assert.equal(aspectoCita(cita({ estado: 'realizada' })), 'sinPagar');
  assert.equal(aspectoCita(cita({ estado: 'no_asistio' })), 'cobrarAusencia');
  assert.equal(aspectoCita(cita({ estado: 'cancelada' })), 'cancelada');
});

test('semana, mes y rejilla de horas', () => {
  assert.deepEqual(semanaDe('2026-10-21').slice(0, 2), ['2026-10-19', '2026-10-20']);
  const mes = celdasMes('2026-10-21');
  assert.equal(mes.length, 42);
  assert.equal(mes[0], '2026-09-28');
  assert.deepEqual(posicion('10:30', 50, 60), { top: 150, height: 50 });
  assert.equal(horaEnPunto(155, 60), '10:30');
  assert.equal(horaEnPunto(-5, 60), '08:00');
  assert.equal(horaEnPunto(99999, 60), '20:30');
});

test('el evento de Google solo lleva «Sesión» y las iniciales', () => {
  assert.equal(iniciales('Lucía Martín Sanz'), 'L. M.');
  const d = datosEvento(cita(), paciente, terapeuta);
  assert.equal(d.title, 'Sesión · L. M.');
  assert.equal(d.endDate.getTime() - d.startDate.getTime(), 50 * 60_000);
  assert.equal(d.startDate.getHours(), 10);
  assert.equal(datosEvento(cita({ modalidad: 'online' }), paciente, terapeuta).location, 'Online');
});

test('el plan crea, actualiza solo si cambia y borra las canceladas', () => {
  const firma = firmaEvento(datosEvento(cita(), paciente, terapeuta));
  const plan = planPublicacion(
    [cita(), cita({ id: 'c2', hora: '12:00' }), cita({ id: 'c3', estado: 'cancelada_tarde' }), cita({ id: 'c4' })],
    [paciente], terapeuta,
    [{ citaId: 'c1', eventoId: 'e1', firma }, { citaId: 'c2', eventoId: 'e2', firma }, { citaId: 'c3', eventoId: 'e3', firma }],
  );
  assert.deepEqual(plan.crear.map(x => x.cita.id), ['c4']);
  assert.deepEqual(plan.actualizar.map(x => x.eventoId), ['e2']);
  assert.deepEqual(plan.borrar.map(x => x.eventoId), ['e3']);
});
