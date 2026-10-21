import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { clienteSupabase, sincronizar } from './supabase';
import { copiaAutomatica } from './drive';
import { publicarCitas } from './googleCalendar';

// Sincroniza al abrir la app, al volver a ella o al dejarla, y cada dos minutos mientras está abierta.
// Al abrirla o volver a ella, hace además la copia diaria en Google Drive si aún no se ha hecho.
export function SincronizacionAutomatica() {
  const db = useSQLiteContext();
  useEffect(() => {
    // Los errores quedan guardados y se ven en Ajustes. Tras sincronizar se publican las citas en Google Calendar.
    const intentar = () => {
      sincronizar(db).catch(() => {}).finally(() => publicarCitas(db).catch(() => {}));
    };
    intentar();
    copiaAutomatica(db);
    const intervalo = setInterval(intentar, 120_000);
    const sub = AppState.addEventListener('change', async estado => {
      const c = await clienteSupabase(db);
      if (estado === 'active') { c?.auth.startAutoRefresh(); copiaAutomatica(db); }
      else c?.auth.stopAutoRefresh();
      intentar();
    });
    return () => { clearInterval(intervalo); sub.remove(); };
  }, [db]);
  return null;
}
