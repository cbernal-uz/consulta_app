import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import * as Calendar from 'expo-calendar/legacy';
import { leerTerapeuta, listarCitas, listarPacientes } from '../db/repo';
import { planPublicacion, firmaEvento, type Publicado } from '../domain/calendario';
import { isoFecha, sumarDias } from '../domain/reglas';
import { guardarConfig, leerConfig } from './config';

// Publica las citas en un calendario del dispositivo (el de la cuenta de Gmail de Teresa), que el sistema
// sincroniza con Google. Solo un dispositivo debe publicar, para no duplicar eventos.

const DIAS_ATRAS = 30;
const DIAS_ADELANTE = 180;

export interface CalendarioDisponible { id: string; titulo: string; cuenta: string; color: string }

export async function pedirPermiso(): Promise<boolean> {
  return (await Calendar.requestCalendarPermissionsAsync()).status === 'granted';
}

/** Calendarios en los que se puede escribir, con los de Google primero. */
export async function calendariosEscribibles(): Promise<CalendarioDisponible[]> {
  const cs = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cs
    .filter(c => c.allowsModifications)
    .map(c => ({ id: c.id, titulo: c.title, cuenta: c.source?.name ?? '', color: c.color }))
    .sort((a, b) => Number(b.cuenta.includes('@gmail.') || b.cuenta.includes('google')) - Number(a.cuenta.includes('@gmail.') || a.cuenta.includes('google')));
}

let enCurso = false;

/** Crea, cambia o quita eventos para que el calendario elegido refleje las citas de los próximos meses. */
export async function publicarCitas(db: SQLiteDatabase): Promise<{ creados: number; cambiados: number; quitados: number } | null> {
  const calendarioId = await leerConfig(db, 'gcal_id');
  if (!calendarioId || enCurso) return null;
  if ((await Calendar.getCalendarPermissionsAsync()).status !== 'granted') return null;
  enCurso = true;
  try {
    const hoy = isoFecha(new Date());
    const [citas, pacientes, t, publicados] = await Promise.all([
      listarCitas(db, sumarDias(hoy, -DIAS_ATRAS), sumarDias(hoy, DIAS_ADELANTE)), listarPacientes(db), leerTerapeuta(db),
      db.getAllAsync<Publicado>('SELECT cita_id AS citaId, evento_id AS eventoId, firma FROM eventos_calendario'),
    ]);
    const plan = planPublicacion(citas, pacientes, t, publicados);
    const guardar = (citaId: string, eventoId: string, firma: string) => db.runAsync(
      'INSERT INTO eventos_calendario (cita_id, evento_id, firma) VALUES (?, ?, ?) ON CONFLICT(cita_id) DO UPDATE SET evento_id = excluded.evento_id, firma = excluded.firma',
      citaId, eventoId, firma,
    );
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    for (const { cita, datos } of plan.crear) {
      const id = await Calendar.createEventAsync(calendarioId, { ...datos, timeZone: zona, alarms: [] });
      await guardar(cita.id, id, firmaEvento(datos));
    }
    for (const { cita, eventoId, datos } of plan.actualizar) {
      try {
        await Calendar.updateEventAsync(eventoId, { ...datos, timeZone: zona });
        await guardar(cita.id, eventoId, firmaEvento(datos));
      } catch {
        // Si alguien borró el evento a mano en Google, se vuelve a crear.
        await guardar(cita.id, await Calendar.createEventAsync(calendarioId, { ...datos, timeZone: zona, alarms: [] }), firmaEvento(datos));
      }
    }
    for (const p of plan.borrar) {
      await Calendar.deleteEventAsync(p.eventoId).catch(() => {});
      await db.runAsync('DELETE FROM eventos_calendario WHERE cita_id = ?', p.citaId);
    }
    await guardarConfig(db, 'gcal_ultima', new Date().toISOString());
    await guardarConfig(db, 'gcal_error', null);
    return { creados: plan.crear.length, cambiados: plan.actualizar.length, quitados: plan.borrar.length };
  } catch (e) {
    await guardarConfig(db, 'gcal_error', e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    enCurso = false;
  }
}

export async function dejarDePublicar(db: SQLiteDatabase, borrarEventos: boolean): Promise<void> {
  if (borrarEventos) {
    const ids = await db.getAllAsync<{ evento_id: string }>('SELECT evento_id FROM eventos_calendario');
    for (const { evento_id } of ids) await Calendar.deleteEventAsync(evento_id).catch(() => {});
  }
  await db.runAsync('DELETE FROM eventos_calendario');
  await guardarConfig(db, 'gcal_id', null);
}

export interface Ocupado { fecha: string; hora: string; duracionMin: number; titulo: string }

/** Otros compromisos del dispositivo (todos sus calendarios), sin los eventos que publica la app. */
export async function compromisos(db: SQLiteDatabase, desde: string, hasta: string): Promise<Ocupado[]> {
  if ((await leerConfig(db, 'gcal_ocupado')) === '0') return [];
  if ((await Calendar.getCalendarPermissionsAsync()).status !== 'granted') return [];
  const propios = new Set((await db.getAllAsync<{ evento_id: string }>('SELECT evento_id FROM eventos_calendario')).map(e => e.evento_id));
  const cs = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const fin = new Date(`${hasta}T23:59:59`);
  const eventos = await Calendar.getEventsAsync(cs.map(c => c.id), new Date(`${desde}T00:00:00`), fin);
  return eventos
    .filter(e => !propios.has(e.id) && !e.allDay && !(Platform.OS === 'ios' && e.availability === Calendar.Availability.FREE))
    .map(e => {
      const ini = new Date(e.startDate);
      const dur = Math.round((new Date(e.endDate).getTime() - ini.getTime()) / 60_000);
      return { fecha: isoFecha(ini), hora: `${String(ini.getHours()).padStart(2, '0')}:${String(ini.getMinutes()).padStart(2, '0')}`, duracionMin: dur, titulo: e.title };
    });
}
