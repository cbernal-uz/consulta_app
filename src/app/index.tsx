import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { cambiarEstado, listarCitas, listarPacientes, marcarPago } from '../db/repo';
import { ESTADOS, esCobrable, fechaCorta, formatoEuros, isoFecha, lunesDe, sumarDias } from '../domain/reglas';
import type { Cita, EstadoCita, Paciente } from '../domain/types';
import { Boton, Chip, Tarjeta, estilos } from '../ui/componentes';

export default function Sesiones() {
  const db = useSQLiteContext();
  const [lunes, setLunes] = useState(() => lunesDe(isoFecha(new Date())));
  const [citas, setCitas] = useState<Cita[]>([]);
  const [pacientes, setPacientes] = useState<Record<string, Paciente>>({});
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [cs, ps] = await Promise.all([listarCitas(db, lunes, sumarDias(lunes, 6)), listarPacientes(db)]);
    setCitas(cs);
    setPacientes(Object.fromEntries(ps.map(p => [p.id, p])));
  }, [db, lunes]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const cobrables = citas.filter(c => esCobrable(c.estado));
  const cobrado = cobrables.filter(c => c.pagada).reduce((s, c) => s + c.precioCentimos, 0);
  const pendiente = cobrables.filter(c => !c.pagada).reduce((s, c) => s + c.precioCentimos, 0);

  const estado = async (c: Cita, e: EstadoCita) => { await cambiarEstado(db, c.id, e); await cargar(); };
  const pago = async (c: Cita) => { await marcarPago(db, c.id, !c.pagada, null); await cargar(); };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <Boton titulo="‹" secundario onPress={() => setLunes(sumarDias(lunes, -7))} />
        <Text style={estilos.nombre}>Semana del {fechaCorta(lunes)}</Text>
        <Boton titulo="›" secundario onPress={() => setLunes(sumarDias(lunes, 7))} />
      </View>
      <View style={estilos.fila}>
        <Tarjeta><Text style={estilos.meta}>Cobrado</Text><Text style={[estilos.num, { fontSize: 18 }]}>{formatoEuros(cobrado)}</Text></Tarjeta>
        <Tarjeta><Text style={estilos.meta}>Pendiente</Text><Text style={[estilos.num, { fontSize: 18 }]}>{formatoEuros(pendiente)}</Text></Tarjeta>
      </View>
      <Boton titulo="Nueva cita" onPress={() => router.push('/nueva-cita')} />
      {citas.length === 0 && <Text style={estilos.sub}>No hay sesiones esta semana. Crea una con «Nueva cita».</Text>}
      {citas.map(c => {
        const p = pacientes[c.pacienteId];
        return (
          <Tarjeta key={c.id}>
            <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <Text style={estilos.nombre}>{p?.nombre ?? 'Paciente'}</Text>
                <Text style={estilos.meta}>{fechaCorta(c.fecha)} · {c.hora} · {c.duracionMin} min · {formatoEuros(c.precioCentimos)}</Text>
              </View>
              {esCobrable(c.estado)
                ? <Chip texto={c.pagada ? 'Pagada' : 'Pendiente'} activo tono={c.pagada ? 'ok' : 'aviso'} onPress={() => pago(c)} />
                : <Chip texto="Sin cobro" />}
            </View>
            <Chip texto={ESTADOS[c.estado]} activo tono={c.estado === 'programada' ? 'acento' : esCobrable(c.estado) ? 'ok' : 'mal'}
              onPress={c.facturaId ? undefined : () => setAbierta(abierta === c.id ? null : c.id)} />
            {c.facturaId && <Text style={estilos.meta}>Facturada: ya no se puede cambiar.</Text>}
            {abierta === c.id && (
              <View style={estilos.fila}>
                {(Object.keys(ESTADOS) as EstadoCita[]).map(e => (
                  <Chip key={e} texto={ESTADOS[e]} activo={e === c.estado} onPress={() => { setAbierta(null); estado(c, e); }} />
                ))}
              </View>
            )}
          </Tarjeta>
        );
      })}
    </ScrollView>
  );
}
