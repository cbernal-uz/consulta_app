import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { guardarTerapeuta, leerTerapeuta } from '../db/repo';
import type { Terapeuta } from '../domain/types';
import { Boton, Campo, Tarjeta, colores, estilos } from '../ui/componentes';
import { leerConfig } from '../sync/config';
import { conectar, desconectar, pendientesDeSubir, sincronizar, usuarioConectado } from '../sync/supabase';
import { elegirCopia, guardarCopia, restaurarCopia } from '../sync/copia';
import { resumenCopia } from '../domain/copia';

const cuando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

type EstadoSync = { url: string; key: string; usuario: string | null; ultima: string | null; error: string | null; pendientes: number; ultimaCopia: string | null };

export default function Ajustes() {
  const db = useSQLiteContext();
  const [t, setT] = useState<Terapeuta | null>(null);
  const [sync, setSync] = useState<EstadoSync | null>(null);
  const [acceso, setAcceso] = useState({ email: '', password: '' });
  const [ocupado, setOcupado] = useState(false);

  const cargarSync = useCallback(async () => {
    setSync({
      url: (await leerConfig(db, 'supabase_url')) ?? '', key: (await leerConfig(db, 'supabase_key')) ?? '',
      usuario: await usuarioConectado(db), ultima: await leerConfig(db, 'ultima_sincronizacion'),
      error: await leerConfig(db, 'error_sincronizacion'), pendientes: await pendientesDeSubir(db),
      ultimaCopia: await leerConfig(db, 'ultima_copia'),
    });
  }, [db]);
  useFocusEffect(useCallback(() => { leerTerapeuta(db).then(setT); cargarSync(); }, [db, cargarSync]));
  if (!t || !sync) return null;

  const tarea = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try { await fn(); } catch (e) { Alert.alert('No se pudo completar', mensaje(e)); } finally { setOcupado(false); cargarSync(); }
  };
  const entrar = () => tarea(async () => {
    await conectar(db, sync.url, sync.key, acceso.email, acceso.password);
    setAcceso({ email: '', password: '' });
    const r = await sincronizar(db);
    Alert.alert('Conectada', r ? `Sincronizado: ${r.bajadas} cambios recibidos y ${r.subidas} enviados.` : 'Sesión iniciada.');
  });
  const sincronizarAhora = () => tarea(async () => {
    const r = await sincronizar(db);
    if (r) Alert.alert('Sincronizado', `${r.bajadas} cambios recibidos y ${r.subidas} enviados.`);
  });
  const restaurar = () => tarea(async () => {
    const copia = await elegirCopia();
    if (!copia) return;
    Alert.alert('¿Restaurar esta copia?', `Copia del ${cuando(copia.creada)} con ${resumenCopia(copia)}. Se sustituirán todos los datos de esta tablet y se enviarán a la otra al sincronizar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', style: 'destructive', onPress: () => tarea(async () => {
        await restaurarCopia(db, copia);
        await sincronizar(db);
        Alert.alert('Copia restaurada');
      }) },
    ]);
  });
  const diasSinCopia = sync.ultimaCopia ? (Date.now() - Date.parse(sync.ultimaCopia)) / 86_400_000 : Infinity;

  const cambiar = (c: Partial<Terapeuta>) => setT({ ...t, ...c });
  const guardar = async () => { await guardarTerapeuta(db, t); Alert.alert('Guardado', 'Tus datos se usarán en las próximas facturas.'); };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Text style={estilos.sub}>Estos datos aparecen en tus facturas y en los avisos a pacientes.</Text>
      <Campo etiqueta="Nombre completo" value={t.nombre} onChangeText={nombre => cambiar({ nombre })} />
      <Campo etiqueta="NIF" value={t.nif} onChangeText={nif => cambiar({ nif })} autoCapitalize="characters" />
      <Campo etiqueta="Dirección de la consulta" value={t.direccion} onChangeText={direccion => cambiar({ direccion })} />
      <Campo etiqueta="Nº de colegiado" value={t.colegiado} onChangeText={colegiado => cambiar({ colegiado })} />
      <Campo etiqueta="Email" value={t.email} onChangeText={email => cambiar({ email })} keyboardType="email-address" autoCapitalize="none" />
      <Campo etiqueta="Serie de facturas (cambia sola al año nuevo y vuelve a empezar en 1)" value={t.serieFactura} onChangeText={serieFactura => cambiar({ serieFactura })} />
      <Campo etiqueta="Siguiente número de factura" value={String(t.siguienteNumero)} keyboardType="number-pad"
        onChangeText={v => cambiar({ siguienteNumero: Math.max(1, Number(v) || 1) })} />
      <Campo etiqueta="Retención a empresas (%)" value={String(t.retencionEmpresaPct)} keyboardType="decimal-pad"
        onChangeText={v => cambiar({ retencionEmpresaPct: Number(v.replace(',', '.')) || 0 })} />
      <Boton titulo="Guardar" onPress={guardar} />

      <Text style={[estilos.nombre, { marginTop: 24 }]}>Sincronización entre tablets</Text>
      <Tarjeta>
        {sync.usuario ? (
          <>
            <Text style={estilos.nombre}>Conectada como {sync.usuario}</Text>
            <Text style={estilos.meta}>Última sincronización: {cuando(sync.ultima)}. Se sincroniza sola cada dos minutos y al abrir o cerrar la app.</Text>
            <Text style={estilos.meta}>{sync.pendientes ? `${sync.pendientes} cambios pendientes de enviar.` : 'Todo enviado.'}</Text>
            {sync.error && <Text style={[estilos.meta, { color: colores.aviso }]}>Último error: {sync.error}</Text>}
            <Boton titulo={ocupado ? 'Sincronizando…' : 'Sincronizar ahora'} onPress={sincronizarAhora} desactivado={ocupado} />
            <Boton titulo="Desconectar esta tablet" secundario onPress={() => tarea(() => desconectar(db))} desactivado={ocupado} />
          </>
        ) : (
          <>
            <Text style={estilos.meta}>Datos del proyecto de Supabase (Project Settings › API) y la cuenta de la consulta. Usa la misma cuenta en las dos tablets.</Text>
            <Campo etiqueta="URL del proyecto" value={sync.url} onChangeText={url => setSync({ ...sync, url })} autoCapitalize="none" keyboardType="url" placeholder="https://xxxx.supabase.co" />
            <Campo etiqueta="Clave pública (anon / publishable)" value={sync.key} onChangeText={key => setSync({ ...sync, key })} autoCapitalize="none" />
            <Campo etiqueta="Email de la cuenta" value={acceso.email} onChangeText={email => setAcceso({ ...acceso, email })} autoCapitalize="none" keyboardType="email-address" />
            <Campo etiqueta="Contraseña" value={acceso.password} onChangeText={password => setAcceso({ ...acceso, password })} secureTextEntry />
            <Boton titulo={ocupado ? 'Conectando…' : 'Conectar y sincronizar'} onPress={entrar}
              desactivado={ocupado || !sync.url || !sync.key || !acceso.email || !acceso.password} />
          </>
        )}
      </Tarjeta>

      <Text style={[estilos.nombre, { marginTop: 24 }]}>Copia de seguridad</Text>
      <Tarjeta>
        <Text style={estilos.meta}>Guarda un archivo con todos los datos. En el menú que se abre, elige Google Drive.</Text>
        <Text style={[estilos.meta, diasSinCopia > 7 ? { color: colores.aviso } : null]}>
          Última copia: {cuando(sync.ultimaCopia)}{diasSinCopia > 7 ? '. Conviene hacer una cada semana.' : ''}
        </Text>
        <Boton titulo="Guardar copia en Google Drive" onPress={() => tarea(() => guardarCopia(db))} desactivado={ocupado} />
        <Boton titulo="Restaurar una copia" secundario onPress={restaurar} desactivado={ocupado} />
      </Tarjeta>
    </ScrollView>
  );
}
