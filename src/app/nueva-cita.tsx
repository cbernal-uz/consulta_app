import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { crearCita, leerTerapeuta, listarPacientes } from '../db/repo';
import { asuntoAviso, enlaceEmail, enlaceWhatsApp, textoAviso } from '../domain/mensajes';
import { formatoEuros, isoFecha, sumarDias } from '../domain/reglas';
import type { Cita, Paciente, Terapeuta } from '../domain/types';
import { Boton, Campo, Chip, Tarjeta, estilos } from '../ui/componentes';
import { CampoFecha } from '../ui/CampoFecha';

export default function NuevaCita() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ fecha?: string; hora?: string }>();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [terapeuta, setTerapeuta] = useState<Terapeuta | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(params.fecha ?? sumarDias(isoFecha(new Date()), 7));
  const [hora, setHora] = useState(params.hora ?? '10:00');
  const [duracion, setDuracion] = useState('50');
  const [modalidad, setModalidad] = useState<Cita['modalidad']>('presencial');
  const [creada, setCreada] = useState<Cita | null>(null);

  // Al tocar un hueco del calendario: cita nueva con esa fecha y hora, aunque esta pantalla ya estuviera abierta.
  useEffect(() => {
    if (!params.fecha && !params.hora) return;
    if (params.fecha) setFecha(params.fecha);
    if (params.hora) setHora(params.hora);
    setCreada(null);
  }, [params.fecha, params.hora]);

  useFocusEffect(useCallback(() => {
    listarPacientes(db).then(ps => setPacientes(ps.filter(p => p.activo)));
    leerTerapeuta(db).then(setTerapeuta);
  }, [db]));

  const paciente = pacientes.find(p => p.id === pacienteId);

  const guardar = async () => {
    if (!paciente) { Alert.alert('Falta el paciente', 'Elige un paciente para la cita.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
      Alert.alert('Fecha u hora no válidas', 'Usa el formato AAAA-MM-DD para la fecha y HH:MM para la hora.');
      return;
    }
    const cita = await crearCita(db, {
      pacienteId: paciente.id, fecha, hora, duracionMin: Number(duracion) || 50, modalidad,
      precioCentimos: paciente.precioCentimos, estado: 'programada', pagada: false, metodoPago: null, fechaPago: null, facturaId: null,
    });
    setCreada(cita);
  };

  if (creada && paciente && terapeuta) {
    const texto = textoAviso(creada, paciente, terapeuta);
    return (
      <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
        <Text style={estilos.titulo}>Cita creada</Text>
        <Text style={estilos.sub}>Avisa a {paciente.nombre}. Se abrirá la app con el mensaje ya escrito y tú pulsas Enviar.</Text>
        <Tarjeta><Text style={{ color: '#1d2a2f' }}>{texto}</Text></Tarjeta>
        {paciente.telefono ? <Boton titulo="Avisar por WhatsApp" onPress={() => Linking.openURL(enlaceWhatsApp(paciente.telefono, texto))} /> : null}
        {paciente.email ? <Boton titulo="Avisar por email" secundario onPress={() => Linking.openURL(enlaceEmail(paciente.email, asuntoAviso(creada), texto))} /> : null}
        <Boton titulo="Volver a sesiones" secundario onPress={() => { setCreada(null); router.back(); }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Text style={estilos.etiqueta}>Paciente</Text>
      <View style={estilos.fila}>
        {pacientes.map(p => <Chip key={p.id} texto={p.nombre} activo={p.id === pacienteId} onPress={() => setPacienteId(p.id)} />)}
        {pacientes.length === 0 && <Text style={estilos.sub}>Primero da de alta un paciente en la pestaña Pacientes.</Text>}
      </View>
      <View style={estilos.fila}>
        <CampoFecha etiqueta="Fecha" tipo="fecha" value={fecha} onChange={setFecha} />
        <CampoFecha etiqueta="Hora" tipo="hora" value={hora} onChange={setHora} />
      </View>
      <View style={estilos.fila}>
        <Campo etiqueta="Duración (min)" value={duracion} onChangeText={setDuracion} keyboardType="number-pad" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={estilos.etiqueta}>Modalidad</Text>
          <View style={estilos.fila}>
            <Chip texto="Presencial" activo={modalidad === 'presencial'} onPress={() => setModalidad('presencial')} />
            <Chip texto="Online" activo={modalidad === 'online'} onPress={() => setModalidad('online')} />
          </View>
        </View>
      </View>
      {paciente && <Text style={estilos.meta}>Precio: {formatoEuros(paciente.precioCentimos)} (tarifa del paciente)</Text>}
      <Boton titulo="Crear cita" onPress={guardar} />
    </ScrollView>
  );
}
