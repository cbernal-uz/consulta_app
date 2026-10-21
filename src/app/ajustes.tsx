import { useCallback, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { guardarTerapeuta, leerTerapeuta } from '../db/repo';
import type { Terapeuta } from '../domain/types';
import { Boton, Campo, estilos } from '../ui/componentes';

export default function Ajustes() {
  const db = useSQLiteContext();
  const [t, setT] = useState<Terapeuta | null>(null);
  useFocusEffect(useCallback(() => { leerTerapeuta(db).then(setT); }, [db]));
  if (!t) return null;

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
      <Campo etiqueta="Serie de facturas" value={t.serieFactura} onChangeText={serieFactura => cambiar({ serieFactura })} />
      <Campo etiqueta="Siguiente número de factura" value={String(t.siguienteNumero)} keyboardType="number-pad"
        onChangeText={v => cambiar({ siguienteNumero: Math.max(1, Number(v) || 1) })} />
      <Campo etiqueta="Retención a empresas (%)" value={String(t.retencionEmpresaPct)} keyboardType="decimal-pad"
        onChangeText={v => cambiar({ retencionEmpresaPct: Number(v.replace(',', '.')) || 0 })} />
      <Boton titulo="Guardar" onPress={guardar} />
    </ScrollView>
  );
}
