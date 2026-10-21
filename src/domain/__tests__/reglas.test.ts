/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borradorFactura, esCobrable, estadoCancelacion, lunesDe, numeroFactura, serieParaFecha } from '../reglas.ts';
import { enlaceWhatsApp, eventoIcs, textoAviso } from '../mensajes.ts';
import type { Cita, Paciente, Terapeuta } from '../types.ts';

const terapeuta: Terapeuta = {
  nombre: 'Carlos Bernal', nif: '12345678Z', direccion: 'C/ Ejemplo 1, Zaragoza', colegiado: 'A-0000',
  email: 'carlos@example.com', serieFactura: '2026-', siguienteNumero: 14, retencionEmpresaPct: 15,
};

const paciente = (tipo: Paciente['tipo']): Paciente => ({
  id: 'p1', nombre: 'Marta Gil', email: 'marta@example.com', telefono: '+34 600 111 222', precioCentimos: 7000,
  tipo, fiscal: { nombre: 'Grupo Atenea S.L.', nif: 'B00000000', direccion: 'C/ Mayor 2' }, activo: true,
});

const cita = (over: Partial<Cita>): Cita => ({
  id: 'c' + Math.random(), pacienteId: 'p1', fecha: '2026-10-07', hora: '12:00', duracionMin: 50, modalidad: 'presencial',
  precioCentimos: 7000, estado: 'realizada', pagada: false, metodoPago: null, fechaPago: null, facturaId: null, ...over,
});

test('se cobran realizadas, cancelaciones tardías y ausencias', () => {
  assert.equal(esCobrable('realizada'), true);
  assert.equal(esCobrable('cancelada_tarde'), true);
  assert.equal(esCobrable('no_asistio'), true);
  assert.equal(esCobrable('cancelada'), false);
  assert.equal(esCobrable('programada'), false);
});

test('una cancelación con menos de 24 h se marca como tardía', () => {
  const inicio = new Date(2026, 9, 22, 10, 0);
  assert.equal(estadoCancelacion(inicio, new Date(2026, 9, 21, 12, 0)), 'cancelada_tarde');
  assert.equal(estadoCancelacion(inicio, new Date(2026, 9, 21, 10, 0)), 'cancelada');
});

test('la factura de empresa aplica retención y excluye lo no cobrable o ya facturado', () => {
  const citas = [
    cita({ fecha: '2026-10-07' }),
    cita({ fecha: '2026-10-14', estado: 'cancelada_tarde' }),
    cita({ fecha: '2026-10-21', estado: 'cancelada' }),
    cita({ fecha: '2026-10-28', estado: 'programada' }),
    cita({ fecha: '2026-09-30' }),
    cita({ fecha: '2026-10-02', facturaId: 'f1' }),
  ];
  const b = borradorFactura(paciente('empresa'), citas, '2026-10', terapeuta);
  assert.equal(b.lineas.length, 2);
  assert.equal(b.lineas[1].concepto, 'Sesión cancelada con menos de 24 h');
  assert.equal(b.baseCentimos, 14000);
  assert.equal(b.retencionCentimos, 2100);
  assert.equal(b.totalCentimos, 11900);
});

test('la factura de particular no lleva retención', () => {
  const b = borradorFactura(paciente('particular'), [cita({})], '2026-10', terapeuta);
  assert.equal(b.retencionCentimos, 0);
  assert.equal(b.totalCentimos, 7000);
});

test('numeración y semanas', () => {
  assert.equal(numeroFactura('2026-', 14), '2026-014');
  assert.equal(lunesDe('2026-10-21'), '2026-10-19');
  assert.equal(lunesDe('2026-10-25'), '2026-10-19');
});

test('el aviso no incluye datos clínicos y el enlace de WhatsApp lleva solo dígitos', () => {
  const c = cita({ fecha: '2026-10-28', hora: '10:00' });
  const texto = textoAviso(c, paciente('particular'), terapeuta);
  assert.match(texto, /Hola Marta/);
  assert.match(texto, /\(28 de octubre de 2026\) a las 10:00/);
  assert.ok(enlaceWhatsApp('+34 600 111 222', texto).startsWith('https://wa.me/34600111222?text='));
});

test('el .ics usa la hora de Madrid y la duración de la cita', () => {
  const ics = eventoIcs(cita({ fecha: '2026-10-28', hora: '09:30', duracionMin: 50 }), terapeuta, new Date('2026-10-21T20:00:00Z'));
  assert.match(ics, /DTSTART;TZID=Europe\/Madrid:20261028T093000/);
  assert.match(ics, /DTEND;TZID=Europe\/Madrid:20261028T102000/);
});

test('en enero de 2027 la serie pasa a 2027- y empieza en 1', () => {
  assert.deepEqual(serieParaFecha('2026-', 48, '2026-12-31'), { serie: '2026-', siguiente: 48 });
  assert.deepEqual(serieParaFecha('2026-', 48, '2027-01-02'), { serie: '2027-', siguiente: 1 });
});
