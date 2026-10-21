import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { leerTerapeuta, listarCitas, listarPacientes } from '../db/repo';
import { formatoEuros, isoFecha } from '../domain/reglas';
import { resumenPorMes, resumenPorTrimestre, totalFilas, type FilaResumen, type Totales } from '../domain/resumen';
import { Chip, Tarjeta, colores, estilos } from '../ui/componentes';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const etiqueta = (clave: string) => (clave.includes('-T') ? `${clave.slice(-1)}º trimestre` : MESES[Number(clave.slice(5, 7)) - 1]);

function Bloque({ titulo, t }: { titulo: string; t: Totales }) {
  const fila = (texto: string, v: number, color?: string) => (
    <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
      <Text style={estilos.meta}>{texto}</Text>
      <Text style={[estilos.num, color ? { color } : null]}>{formatoEuros(v)}</Text>
    </View>
  );
  return (
    <Tarjeta>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <Text style={estilos.nombre}>{titulo}</Text>
        <Text style={[estilos.nombre, { fontSize: 17 }]}>{formatoEuros(t.total)}</Text>
      </View>
      <Text style={estilos.meta}>{t.sesiones} sesiones cobrables</Text>
      {fila('Con factura', t.conFactura)}
      {fila('Sin factura', t.sinFactura)}
      {fila('Cobrado', t.cobrado)}
      {fila('Sin cobrar', t.sinCobrar, t.sinCobrar ? colores.aviso : undefined)}
      {fila('Retenciones IRPF (empresas)', t.retenciones)}
    </Tarjeta>
  );
}

export default function Resumen() {
  const db = useSQLiteContext();
  const [anio, setAnio] = useState(Number(isoFecha(new Date()).slice(0, 4)));
  const [porTrimestre, setPorTrimestre] = useState(false);
  const [filas, setFilas] = useState<FilaResumen[]>([]);

  const cargar = useCallback(async () => {
    const [citas, pacientes, t] = await Promise.all([
      listarCitas(db, `${anio}-01-01`, `${anio}-12-31`), listarPacientes(db), leerTerapeuta(db),
    ]);
    const f = porTrimestre ? resumenPorTrimestre : resumenPorMes;
    setFilas(f(citas, pacientes, t.retencionEmpresaPct));
  }, [db, anio, porTrimestre]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={estilos.fila}>
        {[anio - 1, anio, anio + 1].map(a => <Chip key={a} texto={String(a)} activo={a === anio} onPress={() => setAnio(a)} />)}
      </View>
      <View style={estilos.fila}>
        <Chip texto="Por mes" activo={!porTrimestre} onPress={() => setPorTrimestre(false)} />
        <Chip texto="Por trimestre" activo={porTrimestre} onPress={() => setPorTrimestre(true)} />
      </View>
      <Text style={estilos.sub}>Por fecha de sesión. Incluye las sesiones realizadas, las canceladas con menos de 24 h y las ausencias. IVA exento.</Text>
      <Bloque titulo={`Total ${anio}`} t={totalFilas(filas)} />
      {[...filas].reverse().map(f => <Bloque key={f.clave} titulo={etiqueta(f.clave)} t={f} />)}
      {filas.length === 0 && <Text style={estilos.sub}>No hay sesiones cobrables en {anio}.</Text>}
    </ScrollView>
  );
}
