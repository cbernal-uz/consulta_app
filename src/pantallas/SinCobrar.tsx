import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listarPacientes, listarSinCobrar, marcarPago } from '../db/repo';
import { ESTADOS, fechaCorta, formatoEuros } from '../domain/reglas';
import type { Cita, Paciente } from '../domain/types';
import { Chip, Tarjeta, colores, estilos } from '../ui/componentes';

export default function SinCobrar() {
  const db = useSQLiteContext();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);

  const cargar = useCallback(async () => {
    const [cs, ps] = await Promise.all([listarSinCobrar(db), listarPacientes(db)]);
    setCitas(cs); setPacientes(ps);
  }, [db]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const pagar = async (ids: string[]) => {
    for (const id of ids) await marcarPago(db, id, true, null);
    await cargar();
  };

  const suma = (cs: Cita[]) => cs.reduce((s, c) => s + c.precioCentimos, 0);
  const grupos = pacientes
    .map(p => ({ p, cs: citas.filter(c => c.pacienteId === p.id) }))
    .filter(g => g.cs.length > 0)
    .sort((a, b) => suma(b.cs) - suma(a.cs));

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Tarjeta>
        <Text style={estilos.meta}>Total pendiente de cobro</Text>
        <Text style={[estilos.num, { fontSize: 22, color: colores.aviso }]}>{formatoEuros(suma(citas))}</Text>
        <Text style={estilos.meta}>{citas.length} sesiones · {grupos.length} pacientes</Text>
      </Tarjeta>
      {grupos.length === 0 && <Text style={estilos.sub}>No hay sesiones pendientes de cobro.</Text>}
      {grupos.map(({ p, cs }) => (
        <Tarjeta key={p.id}>
          <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{p.nombre}</Text>
              <Text style={estilos.meta}>{cs.length} sesiones · {formatoEuros(suma(cs))}</Text>
            </View>
            <Chip texto="Todas pagadas" activo onPress={() => pagar(cs.map(c => c.id))} />
          </View>
          {cs.map(c => (
            <View key={c.id} style={[estilos.fila, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.num}>{fechaCorta(c.fecha)} · {c.hora}</Text>
                <Text style={estilos.meta}>{ESTADOS[c.estado]}{c.facturaId ? ' · facturada' : ' · sin facturar'}</Text>
              </View>
              <Text style={estilos.num}>{formatoEuros(c.precioCentimos)}</Text>
              <Chip texto="Pagada" tono="aviso" activo onPress={() => pagar([c.id])} />
            </View>
          ))}
        </Tarjeta>
      ))}
    </ScrollView>
  );
}
