import { esCobrable } from './reglas.ts';
import type { Cita, Paciente } from './types.ts';

// Ingresos por fecha de sesión: con y sin factura, cobrados, sin cobrar y retenciones.

export interface Totales {
  conFactura: number;
  sinFactura: number;
  total: number;
  cobrado: number;
  sinCobrar: number;
  retenciones: number;
  sesiones: number;
}

export interface FilaResumen extends Totales {
  clave: string; // AAAA-MM o AAAA-T1..T4
}

const vacio = (): Totales => ({ conFactura: 0, sinFactura: 0, total: 0, cobrado: 0, sinCobrar: 0, retenciones: 0, sesiones: 0 });

function sumar(t: Totales, c: Cita, p: Paciente, retencionPct: number) {
  if (p.sinFactura) t.sinFactura += c.precioCentimos;
  else {
    t.conFactura += c.precioCentimos;
    if (p.tipo === 'empresa') t.retenciones += Math.round((c.precioCentimos * retencionPct) / 100);
  }
  t.total += c.precioCentimos;
  if (c.pagada) t.cobrado += c.precioCentimos;
  else t.sinCobrar += c.precioCentimos;
  t.sesiones++;
}

function agrupar(citas: Cita[], pacientes: Paciente[], retencionPct: number, clave: (fecha: string) => string): FilaResumen[] {
  const porId = new Map(pacientes.map(p => [p.id, p]));
  const filas = new Map<string, Totales>();
  for (const c of citas) {
    const p = porId.get(c.pacienteId);
    if (!p || !esCobrable(c.estado)) continue;
    const k = clave(c.fecha);
    if (!filas.has(k)) filas.set(k, vacio());
    sumar(filas.get(k)!, c, p, retencionPct);
  }
  return [...filas.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, t]) => ({ clave: k, ...t }));
}

export const resumenPorMes = (citas: Cita[], pacientes: Paciente[], retencionPct: number) =>
  agrupar(citas, pacientes, retencionPct, f => f.slice(0, 7));

export const resumenPorTrimestre = (citas: Cita[], pacientes: Paciente[], retencionPct: number) =>
  agrupar(citas, pacientes, retencionPct, f => `${f.slice(0, 4)}-T${Math.floor((Number(f.slice(5, 7)) - 1) / 3) + 1}`);

export function totalFilas(filas: Totales[]): Totales {
  return filas.reduce((t, f) => {
    for (const k of Object.keys(t) as (keyof Totales)[]) t[k] += f[k];
    return t;
  }, vacio());
}
