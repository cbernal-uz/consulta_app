import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { guardarTerapeuta, leerTerapeuta } from '../db/repo';
import type { Terapeuta } from '../domain/types';
import { Boton, Campo, Casilla, Tarjeta, colores, estilos } from '../ui/componentes';
import { guardarConfig, leerConfig } from '../sync/config';
import { conectar, desconectar, pendientesDeSubir, sincronizar, usuarioConectado } from '../sync/supabase';
import { elegirCopia, guardarCopia, restaurarCopia } from '../sync/copia';
import { resumenCopia, type Copia } from '../domain/copia';
import { descifrarCopia, esCopiaCifrada, type CopiaCifrada } from '../domain/cifrado';
import { PedirContrasena } from '../ui/Contrasena';
import { AjustesBloqueo } from '../ui/AjustesBloqueo';
import { calendariosEscribibles, dejarDePublicar, pedirPermiso, publicarCitas, type CalendarioDisponible } from '../sync/googleCalendar';
import { conectarGoogle, desconectarGoogle, guardarContrasenaAuto, hayContrasenaAuto, subirCopiaADrive } from '../sync/drive';

const cuando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca');
const web = Platform.OS === 'web';
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

type EstadoSync = { url: string; key: string; usuario: string | null; ultima: string | null; error: string | null; pendientes: number; ultimaCopia: string | null;
  google: string | null; iosClientId: string; auto: boolean; hayContrasena: boolean; ultimaAuto: string | null; errorAuto: string | null;
  gcal: string | null; gcalOcupado: boolean; gcalUltima: string | null; gcalError: string | null };

export default function Ajustes() {
  const db = useSQLiteContext();
  const [t, setT] = useState<Terapeuta | null>(null);
  const [sync, setSync] = useState<EstadoSync | null>(null);
  const [acceso, setAcceso] = useState({ email: '', password: '' });
  const [ocupado, setOcupado] = useState(false);
  const [calendarios, setCalendarios] = useState<CalendarioDisponible[] | null>(null);
  // Qué se está pidiendo con la ventana de contraseña: crear una copia o abrir una cifrada.
  const [pidiendo, setPidiendo] = useState<{ tipo: 'guardar' } | { tipo: 'auto' } | { tipo: 'abrir'; copia: CopiaCifrada } | null>(null);

  const cargarSync = useCallback(async () => {
    setSync({
      url: (await leerConfig(db, 'supabase_url')) ?? '', key: (await leerConfig(db, 'supabase_key')) ?? '',
      usuario: await usuarioConectado(db), ultima: await leerConfig(db, 'ultima_sincronizacion'),
      error: await leerConfig(db, 'error_sincronizacion'), pendientes: await pendientesDeSubir(db),
      ultimaCopia: await leerConfig(db, 'ultima_copia'),
      google: await leerConfig(db, 'google_email'), iosClientId: (await leerConfig(db, 'google_ios_client_id')) ?? '',
      auto: (await leerConfig(db, 'copia_auto')) === '1', hayContrasena: await hayContrasenaAuto(),
      ultimaAuto: await leerConfig(db, 'ultima_copia_auto'), errorAuto: await leerConfig(db, 'error_copia_auto'),
      gcal: await leerConfig(db, 'gcal_id'), gcalOcupado: (await leerConfig(db, 'gcal_ocupado')) !== '0',
      gcalUltima: await leerConfig(db, 'gcal_ultima'), gcalError: await leerConfig(db, 'gcal_error'),
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
  const confirmarRestaurar = (copia: Copia) => {
    Alert.alert('¿Restaurar esta copia?', `Copia del ${cuando(copia.creada)} con ${resumenCopia(copia)}. Se sustituirán todos los datos de este dispositivo y se enviarán a los demás al sincronizar.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Restaurar', style: 'destructive', onPress: () => tarea(async () => {
        await restaurarCopia(db, copia);
        await sincronizar(db);
        Alert.alert('Copia restaurada');
      }) },
    ]);
  };
  const restaurar = () => tarea(async () => {
    const copia = await elegirCopia();
    if (!copia) return;
    if (esCopiaCifrada(copia)) setPidiendo({ tipo: 'abrir', copia });
    else confirmarRestaurar(copia);
  });
  const conContrasena = (contrasena: string) => {
    const p = pidiendo;
    setPidiendo(null);
    if (p?.tipo === 'guardar') tarea(() => guardarCopia(db, contrasena));
    if (p?.tipo === 'auto') tarea(async () => {
      await guardarContrasenaAuto(contrasena);
      await guardarConfig(db, 'copia_auto', '1');
      await subirCopiaADrive(db);
      Alert.alert('Copia automática activada', 'Se ha subido la primera copia. A partir de ahora se hará una cada día al abrir la app.');
    });
    if (p?.tipo === 'abrir') tarea(async () => confirmarRestaurar(await descifrarCopia(p.copia, contrasena)));
  };
  const conectarDrive = () => tarea(async () => {
    if (Platform.OS === 'ios') await guardarConfig(db, 'google_ios_client_id', sync.iosClientId.trim());
    await conectarGoogle(db);
  });
  const cambiarAuto = (v: boolean) => (v && !sync.hayContrasena ? setPidiendo({ tipo: 'auto' }) : tarea(() => guardarConfig(db, 'copia_auto', v ? '1' : '0')));
  const elegirCalendario = () => tarea(async () => {
    if (!(await pedirPermiso())) throw new Error('Sin permiso para usar el calendario. Actívalo en los ajustes del dispositivo.');
    setCalendarios(await calendariosEscribibles());
  });
  const publicarEn = (id: string) => tarea(async () => {
    await guardarConfig(db, 'gcal_id', id);
    setCalendarios(null);
    const r = await publicarCitas(db);
    if (r) Alert.alert('Citas publicadas', `${r.creados} citas añadidas al calendario.`);
  });
  const dejarCalendario = () => Alert.alert('Dejar de publicar', '¿Quitar también del calendario los eventos que creó la app?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Dejarlos', onPress: () => tarea(() => dejarDePublicar(db, false)) },
    { text: 'Quitarlos', style: 'destructive', onPress: () => tarea(() => dejarDePublicar(db, true)) },
  ]);
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

      <Text style={[estilos.nombre, { marginTop: 24 }]}>Sincronización entre dispositivos</Text>
      <Tarjeta>
        {sync.usuario ? (
          <>
            <Text style={estilos.nombre}>Conectada como {sync.usuario}</Text>
            <Text style={estilos.meta}>Última sincronización: {cuando(sync.ultima)}. Se sincroniza sola cada dos minutos y al abrir o cerrar la app.</Text>
            <Text style={estilos.meta}>{sync.pendientes ? `${sync.pendientes} cambios pendientes de enviar.` : 'Todo enviado.'}</Text>
            {sync.error && <Text style={[estilos.meta, { color: colores.aviso }]}>Último error: {sync.error}</Text>}
            <Boton titulo={ocupado ? 'Sincronizando…' : 'Sincronizar ahora'} onPress={sincronizarAhora} desactivado={ocupado} />
            <Boton titulo="Desconectar este dispositivo" secundario onPress={() => tarea(() => desconectar(db))} desactivado={ocupado} />
          </>
        ) : (
          <>
            <Text style={estilos.meta}>Datos del proyecto de Supabase (Project Settings › API) y la cuenta de la consulta. Usa la misma cuenta en todos los dispositivos.</Text>
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
        <Text style={estilos.meta}>
          {web ? 'Descarga un archivo cifrado con todos los datos. En el iPhone queda en Archivos › Descargas.' : 'Guarda un archivo cifrado con todos los datos. En el menú que se abre, elige Google Drive.'} Sin la contraseña no se puede abrir: apúntala en un lugar seguro.
        </Text>
        <Text style={[estilos.meta, diasSinCopia > 7 ? { color: colores.aviso } : null]}>
          Última copia: {cuando(sync.ultimaCopia)}{diasSinCopia > 7 ? '. Conviene hacer una cada semana.' : ''}
        </Text>
        <Boton titulo={web ? 'Descargar copia' : 'Guardar copia en Google Drive'} onPress={() => setPidiendo({ tipo: 'guardar' })} desactivado={ocupado} />
        <Boton titulo="Restaurar una copia" secundario onPress={restaurar} desactivado={ocupado} />
      </Tarjeta>

      {web ? (
        <>
          <Text style={[estilos.nombre, { marginTop: 24 }]}>Google Drive y Google Calendar</Text>
          <Tarjeta>
            <Text style={estilos.meta}>La copia diaria en Google Drive y la publicación de citas en Google Calendar se hacen desde la tablet. Las citas que crees aquí llegan a la tablet al sincronizar y, desde ella, a Google Calendar.</Text>
          </Tarjeta>
        </>
      ) : (
        <>
        <Text style={[estilos.nombre, { marginTop: 24 }]}>Copia automática diaria en Google Drive</Text>
        <Tarjeta>
          {sync.google ? (
            <>
              <Text style={estilos.nombre}>Google: {sync.google}</Text>
              <Casilla texto="Subir una copia cifrada cada día" marcada={sync.auto} onCambio={cambiarAuto} />
              <Text style={estilos.meta}>Se hace la primera vez que se abre la app cada día, en la carpeta «Consulta - copias de seguridad». Se guardan las 30 últimas. Última: {cuando(sync.ultimaAuto)}.</Text>
              {sync.errorAuto && <Text style={[estilos.meta, { color: colores.aviso }]}>Último error: {sync.errorAuto}</Text>}
              {sync.auto && <Boton titulo={ocupado ? 'Subiendo…' : 'Subir copia ahora'} onPress={() => tarea(() => subirCopiaADrive(db))} desactivado={ocupado} />}
              {sync.auto && <Boton titulo="Cambiar contraseña de la copia automática" secundario onPress={() => setPidiendo({ tipo: 'auto' })} desactivado={ocupado} />}
              <Boton titulo="Desconectar Google" secundario onPress={() => tarea(() => desconectarGoogle(db))} desactivado={ocupado} />
            </>
          ) : (
            <>
              <Text style={estilos.meta}>Conecta la cuenta de Google donde quieres guardar las copias. La app solo podrá ver los archivos que ella misma cree.</Text>
              {Platform.OS === 'ios' && (
                <Campo etiqueta="ID de cliente de iOS (Google Cloud)" value={sync.iosClientId} onChangeText={iosClientId => setSync({ ...sync, iosClientId })} autoCapitalize="none" />
              )}
              <Boton titulo="Conectar con Google" onPress={conectarDrive} desactivado={ocupado || (Platform.OS === 'ios' && !sync.iosClientId)} />
            </>
          )}
        </Tarjeta>

        <Text style={[estilos.nombre, { marginTop: 24 }]}>Google Calendar</Text>
        <Tarjeta>
          {sync.gcal ? (
            <>
              <Text style={estilos.nombre}>Las citas se publican en el calendario de este dispositivo</Text>
              <Text style={estilos.meta}>Título «Sesión · iniciales», sin otros datos. Las canceladas se quitan. Última vez: {cuando(sync.gcalUltima)}.</Text>
              {sync.gcalError && <Text style={[estilos.meta, { color: colores.aviso }]}>Último error: {sync.gcalError}</Text>}
              <Boton titulo="Publicar ahora" onPress={() => tarea(async () => { await publicarCitas(db); })} desactivado={ocupado} />
              <Boton titulo="Dejar de publicar" secundario onPress={dejarCalendario} desactivado={ocupado} />
            </>
          ) : (
            <>
              <Text style={estilos.meta}>Añade las citas al calendario de Gmail de Teresa. La cuenta de Google tiene que estar añadida en el dispositivo. Actívalo solo en un dispositivo, por ejemplo el iPhone de Teresa, para que no salgan repetidas.</Text>
              {calendarios ? (
                calendarios.length ? calendarios.map(c => (
                  <Boton key={c.id} titulo={`${c.titulo}${c.cuenta && c.cuenta !== c.titulo ? ` · ${c.cuenta}` : ''}`} secundario onPress={() => publicarEn(c.id)} />
                )) : <Text style={estilos.meta}>No hay calendarios en los que escribir. Añade la cuenta de Google en los ajustes del dispositivo.</Text>
              ) : <Boton titulo="Elegir calendario" onPress={elegirCalendario} desactivado={ocupado} />}
            </>
          )}
          <Casilla texto="Mostrar mis otros compromisos en el calendario de la app" marcada={sync.gcalOcupado}
            onCambio={v => tarea(async () => { if (v) await pedirPermiso(); await guardarConfig(db, 'gcal_ocupado', v ? '1' : '0'); })} />
        </Tarjeta>
        </>
      )}

      <AjustesBloqueo />

      <PedirContrasena
        visible={!!pidiendo}
        repetir={pidiendo?.tipo !== 'abrir'}
        titulo={pidiendo?.tipo === 'abrir' ? 'Abrir copia cifrada' : pidiendo?.tipo === 'auto' ? 'Contraseña de las copias automáticas' : 'Contraseña de la copia'}
        explicacion={pidiendo?.tipo === 'auto' ? 'Las copias diarias se cifran con esta contraseña, que queda guardada de forma segura en esta tablet. Apúntala: la necesitarás para restaurar una copia en otra tablet.' : pidiendo?.tipo !== 'abrir' ? 'La copia se cifra con esta contraseña (mínimo 8 caracteres). Si la pierdes, no hay forma de recuperar la copia.' : 'Escribe la contraseña con la que se guardó la copia.'}
        onAceptar={conContrasena}
        onCancelar={() => setPidiendo(null)}
      />
    </ScrollView>
  );
}
