import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as LocalAuthentication from 'expo-local-authentication';
import { guardarConfig, leerConfig } from '../sync/config';
import { Casilla, Tarjeta, colores, estilos } from './componentes';

/** Sección «Bloqueo» de Ajustes en la app: huella, Face ID o código del dispositivo. */
export function AjustesBloqueo() {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<{ bloqueo: boolean; seguridadDispositivo: boolean } | null>(null);
  const cargar = useCallback(async () => {
    setEstado({
      bloqueo: (await leerConfig(db, 'bloqueo')) !== '0',
      seguridadDispositivo: (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE,
    });
  }, [db]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  if (!estado) return null;

  const cambiarBloqueo = async (v: boolean) => { await guardarConfig(db, 'bloqueo', v ? '1' : '0'); cargar(); };
  return (
    <>
      <Text style={[estilos.nombre, { marginTop: 24 }]}>Bloqueo</Text>
      <Tarjeta>
        <Casilla texto="Pedir huella, Face ID o código al abrir la app" marcada={estado.bloqueo} onCambio={cambiarBloqueo} />
        <Text style={estilos.meta}>Se vuelve a bloquear si la app pasa más de un minuto en segundo plano.</Text>
        {!estado.seguridadDispositivo && (
          <Text style={[estilos.meta, { color: colores.aviso }]}>Esta tablet no tiene código ni huella configurados, así que la app no puede bloquearse. Configúralos en los ajustes de la tablet.</Text>
        )}
      </Tarjeta>
    </>
  );
}
