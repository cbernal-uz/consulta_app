import type { SQLiteDatabase } from 'expo-sqlite';
import type { CalendarioDisponible, Ocupado } from './googleCalendar';

// En la web no se publica en Google Calendar: lo hace un solo dispositivo con la app instalada (la tablet),
// y las citas llegan igualmente al calendario del iPhone a través de la cuenta de Google.

export type { CalendarioDisponible, Ocupado };

export const pedirPermiso = async () => false;
export const calendariosEscribibles = async (): Promise<CalendarioDisponible[]> => [];
export const publicarCitas = async (_db: SQLiteDatabase): Promise<{ creados: number; cambiados: number; quitados: number } | null> => null;
export async function dejarDePublicar(_db: SQLiteDatabase, _borrarEventos: boolean): Promise<void> {}
export const compromisos = async (_db: SQLiteDatabase, _desde: string, _hasta: string): Promise<Ocupado[]> => [];
