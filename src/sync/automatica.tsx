import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { clienteSupabase, sincronizar } from './supabase';

// Sincroniza al abrir la app, al volver a ella o al dejarla, y cada dos minutos mientras está abierta.
export function SincronizacionAutomatica() {
  const db = useSQLiteContext();
  useEffect(() => {
    const intentar = () => { sincronizar(db).catch(() => { /* el error queda guardado y se ve en Ajustes */ }); };
    intentar();
    const intervalo = setInterval(intentar, 120_000);
    const sub = AppState.addEventListener('change', async estado => {
      const c = await clienteSupabase(db);
      if (estado === 'active') c?.auth.startAutoRefresh();
      else c?.auth.stopAutoRefresh();
      intentar();
    });
    return () => { clearInterval(intervalo); sub.remove(); };
  }, [db]);
  return null;
}
