import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { emitirFactura, leerTerapeuta, listarCitas, listarPacientes } from '../db/repo';
import { borradorFactura, fechaCorta, formatoEuros, isoFecha, numeroFactura, serieParaFecha } from '../domain/reglas';
import type { Cita, Paciente, Terapeuta } from '../domain/types';
import { Boton, Chip, Tarjeta, estilos } from '../ui/componentes';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function ultimosMeses(n: number): string[] {
  const hoy = new Date();
  return [...Array(n)].map((_, i) => isoFecha(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)).slice(0, 7));
}

const nombreMes = (periodo: string) => `${MESES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;

export default function Facturas() {
  const db = useSQLiteContext();
  const meses = ultimosMeses(3);
  const [periodo, setPeriodo] = useState(meses[0]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [terapeuta, setTerapeuta] = useState<Terapeuta | null>(null);

  const cargar = useCallback(async () => {
    const [ps, cs, t] = await Promise.all([listarPacientes(db), listarCitas(db, `${periodo}-01`, `${periodo}-31`), leerTerapeuta(db)]);
    setPacientes(ps); setCitas(cs); setTerapeuta(t);
  }, [db, periodo]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const paciente = pacientes.find(p => p.id === pacienteId);
  const borrador = paciente && terapeuta ? borradorFactura(paciente, citas, periodo, terapeuta) : null;

  const emitir = async () => {
    if (!borrador || !paciente) return;
    const numero = await emitirFactura(db, borrador, paciente);
    Alert.alert('Factura emitida', `Factura ${numero} para ${paciente.fiscal.nombre}. El PDF llegará en la próxima versión.`);
    await cargar();
  };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Text style={estilos.etiqueta}>Mes</Text>
      <View style={estilos.fila}>{meses.map(m => <Chip key={m} texto={nombreMes(m)} activo={m === periodo} onPress={() => setPeriodo(m)} />)}</View>
      <Text style={estilos.etiqueta}>Paciente</Text>
      <View style={estilos.fila}>{pacientes.map(p => <Chip key={p.id} texto={p.nombre} activo={p.id === pacienteId} onPress={() => setPacienteId(p.id)} />)}</View>
      {borrador && paciente && terapeuta && (
        <Tarjeta>
          <Text style={estilos.nombre}>Factura {(() => { const s = serieParaFecha(terapeuta.serieFactura, terapeuta.siguienteNumero, isoFecha(new Date())); return numeroFactura(s.serie, s.siguiente); })()} · {nombreMes(periodo)}</Text>
          <Text style={estilos.meta}>Cliente: {paciente.fiscal.nombre} · {paciente.fiscal.nif || 'sin NIF'}</Text>
          {borrador.lineas.length === 0 && <Text style={estilos.sub}>No hay sesiones por facturar en este mes.</Text>}
          {borrador.lineas.map(l => (
            <View key={l.citaId} style={[estilos.fila, { justifyContent: 'space-between' }]}>
              <Text style={[estilos.meta, { flex: 1 }]}>{fechaCorta(l.fecha)} {l.hora} · {l.concepto}</Text>
              <Text style={estilos.num}>{formatoEuros(l.importeCentimos)}</Text>
            </View>
          ))}
          {borrador.lineas.length > 0 && (
            <View style={{ gap: 2, alignItems: 'flex-end' }}>
              <Text style={estilos.num}>Base: {formatoEuros(borrador.baseCentimos)}</Text>
              <Text style={estilos.meta}>IVA: exento (art. 20.Uno.3º Ley 37/1992)</Text>
              {borrador.retencionCentimos > 0 && <Text style={estilos.num}>Retención IRPF {borrador.retencionPct} %: −{formatoEuros(borrador.retencionCentimos)}</Text>}
              <Text style={[estilos.nombre, { fontSize: 17 }]}>Total: {formatoEuros(borrador.totalCentimos)}</Text>
            </View>
          )}
          <Boton titulo="Emitir factura" onPress={emitir} desactivado={borrador.lineas.length === 0} />
        </Tarjeta>
      )}
    </ScrollView>
  );
}
