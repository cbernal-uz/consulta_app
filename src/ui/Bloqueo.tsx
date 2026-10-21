import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as LocalAuthentication from 'expo-local-authentication';
import { leerConfig } from '../sync/config';
import { Boton, colores, estilos } from './componentes';

const MINUTOS_SIN_BLOQUEO = 1;

/** Tapa la app hasta que se desbloquea con huella, Face ID o el código del dispositivo. Se activa en Ajustes. */
export function Bloqueo({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [bloqueada, setBloqueada] = useState(true);
  const salida = useRef<number | null>(null);

  const activo = useCallback(async () => {
    if ((await leerConfig(db, 'bloqueo')) === '0') return false;
    // Sin huella ni código en la tablet no hay con qué desbloquear: no se bloquea y Ajustes lo avisa.
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  }, [db]);

  const desbloquear = useCallback(async () => {
    if (!(await activo())) return setBloqueada(false);
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear Consulta', cancelLabel: 'Cancelar' });
    if (r.success) setBloqueada(false);
  }, [activo]);

  useEffect(() => {
    desbloquear();
    const sub = AppState.addEventListener('change', async estado => {
      if (estado === 'background') salida.current = Date.now();
      if (estado === 'active' && salida.current && Date.now() - salida.current > MINUTOS_SIN_BLOQUEO * 60_000 && (await activo())) {
        setBloqueada(true);
        desbloquear();
      }
    });
    return () => sub.remove();
  }, [activo, desbloquear]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {bloqueada && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colores.fondo, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 }}>
          <Text style={[estilos.nombre, { fontSize: 22 }]}>Consulta</Text>
          <Text style={estilos.meta}>Bloqueada para proteger los datos de los pacientes.</Text>
          <Boton titulo="Desbloquear" onPress={desbloquear} />
        </View>
      )}
    </View>
  );
}
