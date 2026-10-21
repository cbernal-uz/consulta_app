import { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { guardarConfig, leerConfig } from '../sync/config';
import { crearPasskey, guardarClaveBloqueo, hayPasskeys } from './bloqueoWeb';
import { Boton, Casilla, Tarjeta, colores, estilos } from './componentes';
import { PedirContrasena } from './Contrasena';

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Sección «Bloqueo» de Ajustes en la web: contraseña de este dispositivo y, opcionalmente, Face ID o huella. */
export function AjustesBloqueo() {
  const db = useSQLiteContext();
  const [estado, setEstado] = useState<{ bloqueo: boolean; clave: boolean; passkey: boolean } | null>(null);
  const [pidiendo, setPidiendo] = useState(false);
  const cargar = useCallback(async () => {
    setEstado({
      bloqueo: (await leerConfig(db, 'bloqueo')) !== '0',
      clave: !!(await leerConfig(db, 'bloqueo_clave')),
      passkey: !!(await leerConfig(db, 'bloqueo_passkey')),
    });
  }, [db]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  if (!estado) return null;

  const tarea = (p: Promise<unknown>) => p.catch(e => Alert.alert('No se pudo completar', mensaje(e))).finally(cargar);
  const conClave = (clave: string) => { setPidiendo(false); tarea(guardarClaveBloqueo(db, clave)); };
  // Sin await antes: Safari solo deja crear la passkey justo al pulsar.
  const anadirPasskey = () => tarea(crearPasskey(db).then(() => Alert.alert('Face ID activado', 'La próxima vez podrás desbloquear con Face ID o la huella.')));

  return (
    <>
      <Text style={[estilos.nombre, { marginTop: 24 }]}>Bloqueo</Text>
      <Tarjeta>
        {estado.clave ? (
          <>
            <Casilla texto="Pedir contraseña o Face ID al abrir la app" marcada={estado.bloqueo}
              onCambio={v => tarea(guardarConfig(db, 'bloqueo', v ? '1' : '0'))} />
            <Text style={estilos.meta}>Se vuelve a bloquear si la app pasa más de un minuto en segundo plano.</Text>
            {hayPasskeys() && (estado.passkey ? (
              <>
                <Text style={estilos.meta}>Face ID o huella activados en este dispositivo.</Text>
                <Boton titulo="Quitar Face ID o huella" secundario onPress={() => tarea(guardarConfig(db, 'bloqueo_passkey', null))} />
              </>
            ) : <Boton titulo="Desbloquear también con Face ID o huella" onPress={anadirPasskey} />)}
            <Boton titulo="Cambiar contraseña" secundario onPress={() => setPidiendo(true)} />
          </>
        ) : (
          <>
            <Text style={estilos.meta}>Pon una contraseña para que la app se bloquee en este dispositivo. Después podrás desbloquear también con Face ID o la huella.</Text>
            <Text style={[estilos.meta, { color: colores.aviso }]}>Sin contraseña, cualquiera que use este navegador puede ver los datos.</Text>
            <Boton titulo="Poner contraseña" onPress={() => setPidiendo(true)} />
          </>
        )}
      </Tarjeta>
      <PedirContrasena visible={pidiendo} repetir titulo="Contraseña de bloqueo"
        explicacion="Solo sirve en este dispositivo. Mínimo 8 caracteres. Si la olvidas, borra los datos del sitio en el navegador y vuelve a conectar Supabase: lo sincronizado se recupera."
        onAceptar={conClave} onCancelar={() => setPidiendo(false)} />
    </>
  );
}
