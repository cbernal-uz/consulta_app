/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvLibroFacturas, rangoTrimestre, trimestreDe, type FacturaEmitida } from '../trimestre.ts';

const f = (over: Partial<FacturaEmitida>): FacturaEmitida => ({
  numero: '2026-001', fecha: '2026-10-01', clienteNombre: 'Lucía Martín', clienteNif: '11111111H',
  baseCentimos: 24000, retencionPct: 0, retencionCentimos: 0, totalCentimos: 24000, ...over,
});

test('rangos de trimestre', () => {
  assert.deepEqual(rangoTrimestre(2026, 1), { desde: '2026-01-01', hasta: '2026-03-31' });
  assert.deepEqual(rangoTrimestre(2026, 4), { desde: '2026-10-01', hasta: '2026-12-31' });
  assert.deepEqual(trimestreDe('2026-09-30'), { anio: 2026, trimestre: 3 });
});

test('el CSV ordena por número, usa coma decimal y suma totales', () => {
  const csv = csvLibroFacturas([
    f({ numero: '2026-012', clienteNombre: 'Grupo Atenea; S.L.', clienteNif: 'B00000000', baseCentimos: 35000, retencionPct: 15, retencionCentimos: 5250, totalCentimos: 29750 }),
    f({ numero: '2026-010' }),
  ]).split('\r\n');
  assert.equal(csv.length, 4);
  assert.match(csv[1], /^2026-010;/);
  assert.match(csv[2], /^2026-012;2026-10-01;"Grupo Atenea; S\.L\.";B00000000;350,00;Exenta;0,00;15;52,50;297,50$/);
  assert.equal(csv[3], 'TOTAL;;;;590,00;;0,00;;52,50;537,50');
});

test('el CSV añade los ingresos sin factura con su total', () => {
  const csv = csvLibroFacturas([f({})], [{ paciente: 'Pablo Navarro', sesiones: 3, importeCentimos: 18000 }]).split('\r\n');
  assert.deepEqual(csv.slice(-4), ['Ingresos sin factura', 'Paciente;Sesiones;Importe', 'Pablo Navarro;3;180,00', 'TOTAL;3;180,00']);
});
