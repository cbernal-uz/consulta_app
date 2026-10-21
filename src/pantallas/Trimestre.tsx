import { useCallback, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listarFacturasCompletas, listarFacturasEmitidas, listarIngresosSinFactura } from '../db/repo';
import { htmlFacturasTrimestre, nombreArchivoTrimestre } from '../domain/pdf';
import { fechaCorta, formatoEuros, isoFecha } from '../domain/reglas';
import { csvIngresosSinFactura, csvLibroFacturas, porCliente, rangoTrimestre, totalesTrimestre, trimestreDe, type FacturaEmitida, type IngresoSinFactura } from '../domain/trimestre';
import { Boton, Chip, Tarjeta, estilos } from '../ui/componentes';

type T = 1 | 2 | 3 | 4;

export default function Trimestre() {
  const db = useSQLiteContext();
  const hoy = trimestreDe(isoFecha(new Date()));
  const [anio, setAnio] = useState(hoy.anio);
  const [trimestre, setTrimestre] = useState<T>(hoy.trimestre);
  const [facturas, setFacturas] = useState<FacturaEmitida[]>([]);
  const [sinFactura, setSinFactura] = useState<IngresoSinFactura[]>([]);
  const [agrupar, setAgrupar] = useState(false);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    const { desde, hasta } = rangoTrimestre(anio, trimestre);
    setFacturas(await listarFacturasEmitidas(db, desde, hasta));
    setSinFactura(await listarIngresosSinFactura(db, desde, hasta));
  }, [db, anio, trimestre]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const t = totalesTrimestre(facturas);
  const enviar = () => Share.share({
    title: `Facturas ${trimestre}T ${anio}`,
    message: csvLibroFacturas(facturas),
  });

  // Un solo PDF: portada con el libro del trimestre y una página por factura (solo facturas emitidas).
  const enviarPdf = async () => {
    setGenerando(true);
    try {
      const { desde, hasta } = rangoTrimestre(anio, trimestre);
      const completas = await listarFacturasCompletas(db, desde, hasta);
      const { uri } = await Print.printToFileAsync({ html: htmlFacturasTrimestre(completas, anio, trimestre) });
      const destino = new File(Paths.cache, nombreArchivoTrimestre(anio, trimestre, completas[0]?.emisor.nombre ?? 'Consulta'));
      if (destino.exists) destino.delete();
      new File(uri).move(destino);
      await Sharing.shareAsync(destino.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Facturas ${trimestre}T ${anio}` });
    } catch (e) {
      Alert.alert('No se pudo crear el PDF', String(e));
    } finally {
      setGenerando(false);
    }
  };

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
      <Boton titulo={generando ? 'Creando PDF…' : 'PDF con todas las facturas'} onPress={enviarPdf} desactivado={facturas.length === 0 || generando} />
      <Boton titulo="Libro de facturas (CSV)" secundario onPress={enviar} desactivado={facturas.length === 0} />
      {sinFactura.length > 0 && (
        <Tarjeta>
          <Text style={estilos.nombre}>Ingresos sin factura: {formatoEuros(sinFactura.reduce((s, i) => s + i.importeCentimos, 0))}</Text>
          {sinFactura.map(i => <Text key={i.paciente} style={estilos.meta}>{i.paciente} · {i.sesiones} sesiones · {formatoEuros(i.importeCentimos)}</Text>)}
          <Text style={estilos.meta}>No van en el archivo de facturas. Envíalos aparte al gestor para que los declare.</Text>
          <Boton titulo="Enviar ingresos sin factura" secundario onPress={() => Share.share({ title: `Ingresos sin factura ${trimestre}T ${anio}`, message: csvIngresosSinFactura(sinFactura) })} />
        </Tarjeta>
      )}
      {facturas.length === 0 && <Text style={estilos.sub}>No hay facturas emitidas en este trimestre.</Text>}
      <View style={estilos.fila}>
        <Chip texto="Por factura" activo={!agrupar} onPress={() => setAgrupar(false)} />
        <Chip texto="Por paciente" activo={agrupar} onPress={() => setAgrupar(true)} />
      </View>
      {agrupar && porCliente(facturas).map(g => (
        <Tarjeta key={g.clienteNif || g.clienteNombre}>
          <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={estilos.nombre}>{g.clienteNombre}</Text>
              <Text style={estilos.meta}>NIF {g.clienteNif || '—'} · {g.facturas.length} facturas{g.retencion ? ` · retención ${formatoEuros(g.retencion)}` : ''}</Text>
            </View>
            <Text style={estilos.num}>{formatoEuros(g.total)}</Text>
          </View>
          {g.facturas.map(f => <Text key={f.numero} style={estilos.meta}>{f.numero} · {fechaCorta(f.fecha)} · {formatoEuros(f.totalCentimos)}</Text>)}
        </Tarjeta>
      ))}
      {!agrupar && facturas.map(f => (
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
