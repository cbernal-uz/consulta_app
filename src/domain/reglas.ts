import type { BorradorFactura, Cita, EstadoCita, LineaFactura, Paciente, Terapeuta } from './types.ts';

export const ESTADOS: Record<EstadoCita, string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  cancelada: 'Cancelada a tiempo',
  cancelada_tarde: 'Cancelada con menos de 24 h',
  no_asistio: 'No asistió',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Una sesión se cobra si se hizo, si se canceló con menos de 24 h o si el paciente no avisó. */
export function esCobrable(estado: EstadoCita): boolean {
  return estado === 'realizada' || estado === 'cancelada_tarde' || estado === 'no_asistio';
}

/** Estado que corresponde a una cancelación según la antelación con la que se avisa. */
export function estadoCancelacion(inicioCita: Date, avisoRecibido: Date): EstadoCita {
  const horas = (inicioCita.getTime() - avisoRecibido.getTime()) / 3_600_000;
  return horas < 24 ? 'cancelada_tarde' : 'cancelada';
}

export function conceptoLinea(estado: EstadoCita): string {
  if (estado === 'cancelada_tarde') return 'Sesión cancelada con menos de 24 h';
  if (estado === 'no_asistio') return 'Sesión no asistida sin aviso';
  return 'Sesión de psicoterapia';
}

/** Reúne las sesiones cobrables y sin facturar de un paciente en un mes (AAAA-MM). */
export function borradorFactura(paciente: Paciente, citas: Cita[], periodo: string, terapeuta: Terapeuta): BorradorFactura {
  const lineas: LineaFactura[] = citas
    .filter(c => c.pacienteId === paciente.id && c.fecha.startsWith(periodo) && esCobrable(c.estado) && !c.facturaId)
    .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora))
    .map(c => ({
      citaId: c.id,
      fecha: c.fecha,
      hora: c.hora,
      duracionMin: c.duracionMin,
      concepto: conceptoLinea(c.estado),
      importeCentimos: c.precioCentimos,
    }));
  const baseCentimos = lineas.reduce((s, l) => s + l.importeCentimos, 0);
  const retencionPct = paciente.tipo === 'empresa' ? terapeuta.retencionEmpresaPct : 0;
  const retencionCentimos = Math.round((baseCentimos * retencionPct) / 100);
  return {
    pacienteId: paciente.id,
    periodo,
    lineas,
    baseCentimos,
    retencionPct,
    retencionCentimos,
    totalCentimos: baseCentimos - retencionCentimos,
  };
}

/** Al cambiar de año, la serie pasa a ser la del año nuevo y la numeración vuelve a empezar en 1. */
export function serieParaFecha(serieActual: string, siguiente: number, fechaEmision: string): { serie: string; siguiente: number } {
  const serieAnio = `${fechaEmision.slice(0, 4)}-`;
  return serieActual === serieAnio ? { serie: serieActual, siguiente } : { serie: serieAnio, siguiente: 1 };
}

export function numeroFactura(serie: string, numero: number): string {
  return `${serie}${String(numero).padStart(3, '0')}`;
}

export function formatoEuros(centimos: number): string {
  return (centimos / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export function parseFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumarDias(iso: string, dias: number): string {
  const d = parseFecha(iso);
  d.setDate(d.getDate() + dias);
  return isoFecha(d);
}

export function lunesDe(iso: string): string {
  const d = parseFecha(iso);
  return sumarDias(iso, -((d.getDay() + 6) % 7));
}

export function fechaCorta(iso: string): string {
  const d = parseFecha(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

export function fechaLarga(iso: string): string {
  const d = parseFecha(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
