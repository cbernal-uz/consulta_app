import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { guardarPaciente, listarPacientes, nuevoId } from '../db/repo';
import { formatoEuros } from '../domain/reglas';
import type { Paciente } from '../domain/types';
import { Boton, Campo, Casilla, Chip, Tarjeta, estilos } from '../ui/componentes';

const vacio = (): Paciente => ({
  id: nuevoId(), nombre: '', email: '', telefono: '', precioCentimos: 6000, tipo: 'particular',
  fiscal: { nombre: '', nif: '', direccion: '' }, activo: true, sinFactura: false,
});

export default function Pacientes() {
  const db = useSQLiteContext();
  const [lista, setLista] = useState<Paciente[]>([]);
  const [editando, setEditando] = useState<Paciente | null>(null);
  const [precio, setPrecio] = useState('');

  const cargar = useCallback(async () => setLista(await listarPacientes(db)), [db]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const abrir = (p: Paciente) => { setEditando(p); setPrecio(String(p.precioCentimos / 100)); };
  const cambiar = (cambios: Partial<Paciente>) => editando && setEditando({ ...editando, ...cambios });
  const cambiarFiscal = (cambios: Partial<Paciente['fiscal']>) => editando && setEditando({ ...editando, fiscal: { ...editando.fiscal, ...cambios } });

  const guardar = async () => {
    if (!editando) return;
    if (!editando.nombre.trim()) { Alert.alert('Falta el nombre', 'Escribe el nombre del paciente.'); return; }
    const euros = Number(precio.replace(',', '.'));
    if (!Number.isFinite(euros) || euros < 0) { Alert.alert('Precio no válido', 'Escribe el precio en euros, por ejemplo 60.'); return; }
    await guardarPaciente(db, { ...editando, precioCentimos: Math.round(euros * 100) });
    setEditando(null);
    await cargar();
  };

  if (editando) {
    return (
      <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
        <Campo etiqueta="Nombre y apellidos" value={editando.nombre} onChangeText={nombre => cambiar({ nombre })} />
        <Campo etiqueta="Email" value={editando.email} onChangeText={email => cambiar({ email })} keyboardType="email-address" autoCapitalize="none" />
        <Campo etiqueta="Teléfono (WhatsApp)" value={editando.telefono} onChangeText={telefono => cambiar({ telefono })} keyboardType="phone-pad" />
        <Campo etiqueta="Precio por sesión (€)" value={precio} onChangeText={setPrecio} keyboardType="decimal-pad" />
        <Text style={estilos.etiqueta}>Se factura a</Text>
        <View style={estilos.fila}>
          <Chip texto="El propio paciente" activo={editando.tipo === 'particular'} onPress={() => cambiar({ tipo: 'particular' })} />
          <Chip texto="Una empresa (con retención)" activo={editando.tipo === 'empresa'} onPress={() => cambiar({ tipo: 'empresa' })} />
        </View>
        <Campo etiqueta="Nombre fiscal (vacío = el del paciente)" value={editando.fiscal.nombre} onChangeText={nombre => cambiarFiscal({ nombre })} />
        <Campo etiqueta="NIF / CIF" value={editando.fiscal.nif} onChangeText={nif => cambiarFiscal({ nif })} autoCapitalize="characters" />
        <Campo etiqueta="Dirección fiscal" value={editando.fiscal.direccion} onChangeText={direccion => cambiarFiscal({ direccion })} />
        <Casilla texto="No se emite factura" marcada={editando.sinFactura} onCambio={sinFactura => cambiar({ sinFactura })} />
        {editando.sinFactura && <Text style={estilos.meta}>No se le generan facturas. Sus cobros cuentan en el resumen y aparecen en Pagos › Trimestre como ingresos sin factura, en un archivo aparte para el gestor.</Text>}
        <View style={estilos.fila}>
          <Chip texto={editando.activo ? 'Activo' : 'De baja'} activo onPress={() => cambiar({ activo: !editando.activo })} tono={editando.activo ? 'ok' : 'mal'} />
        </View>
        <Text style={estilos.meta}>Un cambio de precio se aplica a las citas pendientes. Las facturas emitidas no cambian.</Text>
        <Boton titulo="Guardar" onPress={guardar} />
        <Boton titulo="Cancelar" secundario onPress={() => setEditando(null)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <Boton titulo="Nuevo paciente" onPress={() => abrir(vacio())} />
      {lista.length === 0 && <Text style={estilos.sub}>Aún no hay pacientes.</Text>}
      {lista.map(p => (
        <Tarjeta key={p.id}>
          <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[estilos.nombre, !p.activo && { color: '#5d6b70' }]}>{p.nombre}{p.activo ? '' : ' (de baja)'}</Text>
              <Text style={estilos.meta}>{formatoEuros(p.precioCentimos)} · {p.sinFactura ? 'Sin factura' : p.tipo === 'empresa' ? `Factura a ${p.fiscal.nombre}` : 'Particular'}</Text>
            </View>
            <Chip texto="Editar" activo onPress={() => abrir(p)} />
          </View>
        </Tarjeta>
      ))}
    </ScrollView>
  );
}
