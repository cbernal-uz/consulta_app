import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { leerConfig } from '../sync/config';
import { bloqueoActivo, comprobarClaveBloqueo, hayPasskeys, verificarPasskey } from './bloqueoWeb';
import { Boton, Campo, colores, estilos } from './componentes';

const MINUTOS_SIN_BLOQUEO = 1;

/** Versión web: tapa la app hasta que se escribe la contraseña de este dispositivo o se usa Face ID o la huella. */
export function Bloqueo({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  // null mientras se lee la configuración: se tapa todo sin mostrar nada.
  const [bloqueada, setBloqueada] = useState<boolean | null>(null);
  const [passkey, setPasskey] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const salida = useRef<number | null>(null);

  const comprobar = useCallback(async () => {
    setPasskey(hayPasskeys() ? await leerConfig(db, 'bloqueo_passkey') : null);
    setBloqueada(await bloqueoActivo(db));
  }, [db]);

  useEffect(() => {
    comprobar();
    const cambio = () => {
      if (document.visibilityState === 'hidden') salida.current = Date.now();
      else if (salida.current && Date.now() - salida.current > MINUTOS_SIN_BLOQUEO * 60_000) comprobar();
    };
    document.addEventListener('visibilitychange', cambio);
    return () => document.removeEventListener('visibilitychange', cambio);
  }, [comprobar]);

  const abrir = () => { setClave(''); setError(''); setBloqueada(false); };
  const conClave = async () => {
    if (await comprobarClaveBloqueo(db, clave)) abrir();
    else setError('Contraseña incorrecta.');
  };
  const conPasskey = () => {
    verificarPasskey(passkey!).then(ok => (ok ? abrir() : setError('No se ha podido comprobar.')), () => setError('Cancelado. Puedes usar la contraseña.'));
  };

  return (
    <View style={{ flex: 1 }}>
      {children}
      {bloqueada !== false && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colores.fondo, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          {bloqueada && (
            <View style={{ gap: 16, width: '100%', maxWidth: 360 }}>
              <Text style={[estilos.nombre, { fontSize: 22, textAlign: 'center' }]}>Consulta</Text>
              <Text style={[estilos.meta, { textAlign: 'center' }]}>Bloqueada para proteger los datos de los pacientes.</Text>
              {passkey && <Boton titulo="Desbloquear con Face ID o huella" onPress={conPasskey} />}
              <Campo etiqueta="Contraseña de este dispositivo" value={clave} onChangeText={setClave} secureTextEntry
                autoFocus={!passkey} onSubmitEditing={conClave} />
              {!!error && <Text style={[estilos.meta, { color: colores.aviso }]}>{error}</Text>}
              <Boton titulo="Desbloquear" secundario={!!passkey} onPress={conClave} desactivado={!clave} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
