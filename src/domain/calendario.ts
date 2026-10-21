import { lunesDe, parseFecha, sumarDias } from './reglas.ts';
import type { Cita, Paciente, Terapeuta } from './types.ts';

// Calendario: colocación de las sesiones en la rejilla y publicación en Google Calendar.

export const HORA_INICIO = 8;
export const HORA_FIN = 21;

export type Aspecto = 'programada' | 'pagada' | 'sinPagar' | 'cobrarAusencia' | 'cancelada';

/** Cómo se pinta cada sesión: las pagadas van en verde sólido con una P. */
export function aspectoCita(c: Cita): Aspecto {
  if (c.estado === 'programada') return 'programada';
  if (c.estado === 'cancelada') return 'cancelada';
  if (c.pagada) return 'pagada';
  return c.estado === 'realizada' ? 'sinPagar' : 'cobrarAusencia';
}

export const semanaDe = (iso: string) => Array.from({ length: 7 }, (_, i) => sumarDias(lunesDe(iso), i));

/** 42 días (6 semanas) empezando en el lunes de la semana del día 1 del mes. */
export function celdasMes(iso: string): string[] {
  const primero = `${iso.slice(0, 7)}-01`;
  return Array.from({ length: 42 }, (_, i) => sumarDias(lunesDe(primero), i));
}

/** Posición vertical en píxeles de una sesión dentro de la columna del día. */
export function posicion(hora: string, duracionMin: number, pxHora: number): { top: number; height: number } {
  const [h, m] = hora.split(':').map(Number);
  return { top: (h - HORA_INICIO + m / 60) * pxHora, height: Math.max((duracionMin / 60) * pxHora, 24) };
}

/** Hora redondeada a la media hora más cercana por debajo, a partir del punto tocado en la columna. */
export function horaEnPunto(y: number, pxHora: number): string {
  const max = (HORA_FIN - HORA_INICIO) * 60 - 30;
  const min = Math.min(Math.max(Math.floor((y / pxHora) * 2) * 30, 0), max);
  return `${String(HORA_INICIO + Math.floor(min / 60)).padStart(2, '0')}:${min % 60 ? '30' : '00'}`;
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => `${p[0].toUpperCase()}.`).join(' ');
}

export interface DatosEvento {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  notes: string;
}

/** Sin datos clínicos ni nombre completo: el evento sale de la consulta y lo guarda Google. */
export function datosEvento(c: Cita, p: Paciente, t: Terapeuta): DatosEvento {
  const inicio = parseFecha(c.fecha);
  const [h, m] = c.hora.split(':').map(Number);
  inicio.setHours(h, m, 0, 0);
  return {
    title: `Sesión · ${iniciales(p.nombre)}`,
    startDate: inicio,
    endDate: new Date(inicio.getTime() + c.duracionMin * 60_000),
    location: c.modalidad === 'online' ? 'Online' : t.direccion,
    notes: '',
  };
}

export const firmaEvento = (d: DatosEvento) => [d.title, d.startDate.toISOString(), d.endDate.toISOString(), d.location].join('|');

/** Las canceladas (a tiempo o tarde) dejan libre el hueco, así que no se publican. */
export const sePublica = (c: Cita) => c.estado === 'programada' || c.estado === 'realizada' || c.estado === 'no_asistio';

export interface Publicado { citaId: string; eventoId: string; firma: string }

export interface Plan {
  crear: { cita: Cita; datos: DatosEvento }[];
  actualizar: { cita: Cita; eventoId: string; datos: DatosEvento }[];
  borrar: Publicado[];
}

/** Compara las citas con lo ya publicado y dice qué hay que crear, cambiar o quitar del calendario. */
export function planPublicacion(citas: Cita[], pacientes: Paciente[], t: Terapeuta, publicados: Publicado[]): Plan {
  const porPaciente = new Map(pacientes.map(p => [p.id, p]));
  const porCita = new Map(publicados.map(p => [p.citaId, p]));
  const plan: Plan = { crear: [], actualizar: [], borrar: [] };
  const vistas = new Set<string>();
  for (const c of citas) {
    const p = porPaciente.get(c.pacienteId);
    const ya = porCita.get(c.id);
    vistas.add(c.id);
    if (!p || !sePublica(c)) {
      if (ya) plan.borrar.push(ya);
      continue;
    }
    const datos = datosEvento(c, p, t);
    if (!ya) plan.crear.push({ cita: c, datos });
    else if (ya.firma !== firmaEvento(datos)) plan.actualizar.push({ cita: c, eventoId: ya.eventoId, datos });
  }
  // Publicados cuya cita ya no está en el rango que se revisa: se dejan como están.
  return plan;
}
