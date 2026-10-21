import { useCallback, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listarFacturasEmitidas } from '../db/repo';
import { fechaCorta, formatoEuros, isoFecha } from '../domain/reglas';
import { csvLibroFacturas, rangoTrimestre, totalesTrimestre, trimestreDe, type FacturaEmitida } from '../domain/trimestre';
import { Boton, Chip, Tarjeta, estilos } from '../ui/componentes';

type T = 1 | 2 | 3 | 4;

export default function Trimestre() {
  const db = useSQLiteContext();
  const hoy = trimestreDe(isoFecha(new Date()));
  const [anio, setAnio] = useState(hoy.anio);
  const [trimestre, setTrimestre] = useState<T>(hoy.trimestre);
  const [facturas, setFacturas] = useState<FacturaEmitida[]>([]);

  const cargar = useCallback(async () => {
    const { desde, hasta } = rangoTrimestre(anio, trimestre);
    setFacturas(await listarFacturasEmitidas(db, desde, hasta));
  }, [db, anio, trimestre]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const t = totalesTrimestre(facturas);
  const enviar = () => Share.share({
    title: `Facturas ${trimestre}T ${anio}`,
    message: csvLibroFacturas(facturas),
  });

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={estilos.fila}>
        {[anio - 1, anio, anio + 1].map(a => <Chip key={a} texto={String(a)} activo={a === anio} onPress={() => setAnio(a)} />)}
      </View>
      <View style={estilos.fila}>
        {([1, 2, 3, 4] as T[]).map(q => <Chip key={q} texto={`${q}º trimestre`} activo={q === trimestre} onPress={() => setTrimestre(q)} />)}
      </View>
      <Tarjeta>
        <Text style={estilos.nombre}>{facturas.length} facturas emitidas</Text>
        <Text style={estilos.num}>Base imponible: {formatoEuros(t.base)}</Text>
        <Text style={estilos.meta}>IVA: exento</Text>
        <Text style={estilos.num}>Retenciones IRPF: {formatoEuros(t.retencion)}</Text>
        <Text style={[estilos.nombre, { fontSize: 17 }]}>Total facturado: {formatoEuros(t.total)}</Text>
      </Tarjeta>
      <Boton titulo="Enviar a la gestoría" onPress={enviar} desactivado={facturas.length === 0} />
      {facturas.length === 0 && <Text style={estilos.sub}>No hay facturas emitidas en este trimestre.</Text>}
      {facturas.map(f => (
        <Tarjeta key={f.numero}>
          <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{f.numero} · {f.clienteNombre}</Text>
              <Text style={estilos.meta}>{fechaCorta(f.fecha)} · NIF {f.clienteNif || '—'}{f.retencionCentimos ? ` · retención ${formatoEuros(f.retencionCentimos)}` : ''}</Text>
            </View>
            <Text style={estilos.num}>{formatoEuros(f.totalCentimos)}</Text>
          </View>
        </Tarjeta>
      ))}
    </ScrollView>
  );
}
