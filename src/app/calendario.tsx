import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { cambiarEstado, listarCitas, listarPacientes, marcarPago } from '../db/repo';
import { HORA_FIN, HORA_INICIO, aspectoCita, celdasMes, horaEnPunto, posicion, semanaDe, type Aspecto } from '../domain/calendario';
import { ESTADOS, esCobrable, fechaLarga, formatoEuros, isoFecha, parseFecha, sumarDias } from '../domain/reglas';
import type { Cita, EstadoCita, Paciente } from '../domain/types';
import { compromisos, type Ocupado } from '../sync/googleCalendar';
import { Boton, Chip, Tarjeta, colores, estilos } from '../ui/componentes';

type Modo = 'dia' | 'semana' | 'mes';
const PX_HORA = 56;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Colores por estado, como en el prototipo: las pagadas en verde sólido con una P.
const ASPECTO: Record<Aspecto, { fondo: string; texto: string }> = {
  programada: { fondo: colores.acentoSuave, texto: colores.acento },
  pagada: { fondo: colores.ok, texto: '#ffffff' },
  sinPagar: { fondo: colores.avisoSuave, texto: colores.aviso },
  cobrarAusencia: { fondo: colores.malSuave, texto: colores.mal },
  cancelada: { fondo: colores.fondo, texto: colores.suave },
};

export default function Calendario() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const movil = width < 600;
  const abajo = useSafeAreaInsets().bottom;
  const hoy = isoFecha(new Date());
  const [modo, setModo] = useState<Modo>(movil ? 'dia' : 'semana');
  const [ref, setRef] = useState(hoy);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [ocupado, setOcupado] = useState<Ocupado[]>([]);
  const [pacientes, setPacientes] = useState<Record<string, Paciente>>({});
  const [sel, setSel] = useState<string | null>(null);

  const dias = modo === 'mes' ? celdasMes(ref) : semanaDe(ref);
  const desde = dias[0];
  const hasta = dias[dias.length - 1];

  const cargar = useCallback(async () => {
    const [cs, ps, oc] = await Promise.all([listarCitas(db, desde, hasta), listarPacientes(db), compromisos(db, desde, hasta).catch(() => [])]);
    setCitas(cs);
    setPacientes(Object.fromEntries(ps.map(p => [p.id, p])));
    setOcupado(oc);
  }, [db, desde, hasta]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const mover = (n: number) => {
    setSel(null);
    if (n === 0) return setRef(hoy);
    if (modo === 'dia') return setRef(sumarDias(ref, n));
    if (modo === 'semana') return setRef(sumarDias(ref, 7 * n));
    const d = parseFecha(ref);
    setRef(isoFecha(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };
  const nueva = (fecha: string, hora: string) => router.push({ pathname: '/nueva-cita', params: { fecha, hora } });
  const nombre = (c: Cita) => pacientes[c.pacienteId]?.nombre ?? 'Paciente';

  const r = parseFecha(ref);
  const titulo = modo === 'mes' ? `${MESES[r.getMonth()]} ${r.getFullYear()}`
    : modo === 'dia' ? `${DIAS[r.getDay()]} ${r.getDate()} de ${MESES[r.getMonth()]}`
    : `${parseFecha(dias[0]).getDate()} – ${fechaLarga(dias[6])}`;

  const elegida = citas.find(c => c.id === sel);
  // En la tablet la ficha sale encima del calendario; en el móvil, en una hoja desde abajo para que se vea siempre.
  const ficha = elegida && (
    <Tarjeta>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.nombre}>{nombre(elegida)}</Text>
          <Text style={estilos.meta}>{fechaLarga(elegida.fecha)} · {elegida.hora} · {elegida.duracionMin} min · {formatoEuros(elegida.precioCentimos)}</Text>
        </View>
        <Chip texto="Cerrar" onPress={() => setSel(null)} />
      </View>
      {elegida.facturaId ? <Text style={estilos.meta}>Facturada: el estado ya no se puede cambiar.</Text> : (
        <View style={estilos.fila}>
          {(Object.keys(ESTADOS) as EstadoCita[]).map(e => (
            <Chip key={e} texto={ESTADOS[e]} activo={e === elegida.estado} onPress={async () => { await cambiarEstado(db, elegida.id, e); cargar(); }} />
          ))}
        </View>
      )}
      {esCobrable(elegida.estado) && (
        <Boton titulo={elegida.pagada ? 'Pagada · tocar para marcar pendiente' : 'Marcar como pagada'} secundario={elegida.pagada}
          onPress={async () => { await marcarPago(db, elegida.id, !elegida.pagada, null); cargar(); }} />
      )}
    </Tarjeta>
  );

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={estilos.contenido}>
      <View style={[estilos.fila, { justifyContent: 'space-between' }]}>
        <View style={estilos.fila}>
          <Chip texto="‹" onPress={() => mover(-1)} />
          <Chip texto="Hoy" onPress={() => mover(0)} />
          <Chip texto="›" onPress={() => mover(1)} />
          <Text style={[estilos.nombre, { fontSize: 17 }]}>{titulo}</Text>
        </View>
        <View style={estilos.fila}>
          {(['dia', 'semana', 'mes'] as Modo[]).map(m => (
            <Chip key={m} texto={{ dia: 'Día', semana: 'Semana', mes: 'Mes' }[m]} activo={modo === m} onPress={() => { setModo(m); setSel(null); }} />
          ))}
        </View>
      </View>

      {!movil && ficha}

      {modo === 'dia' && (
        <View style={[estilos.fila, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
          {semanaDe(ref).map(d => {
            const x = parseFecha(d);
            const n = citas.filter(c => c.fecha === d && c.estado !== 'cancelada').length;
            const activo = d === ref;
            return (
              <Pressable key={d} onPress={() => { setRef(d); setSel(null); }} accessibilityRole="button" accessibilityLabel={fechaLarga(d)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, minHeight: 48, backgroundColor: activo ? colores.acento : 'transparent' }}>
                <Text style={{ fontSize: 12, color: activo ? '#fff' : colores.suave }}>{DIAS[x.getDay()]}</Text>
                <Text style={{ fontSize: 17, fontWeight: d === hoy ? '700' : '500', color: activo ? '#fff' : d === hoy ? colores.acento : colores.tinta }}>{x.getDate()}</Text>
                <Text style={{ fontSize: 10, color: activo ? '#fff' : colores.acento }}>{'•'.repeat(Math.min(n, 3))}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {modo === 'mes' ? (
        <Mes dias={dias} referencia={ref} hoy={hoy} citas={citas} nombre={nombre} compacto={movil}
          onDia={d => { setRef(d); setModo(movil ? 'dia' : 'semana'); setSel(null); }} />
      ) : (
        <Rejilla dias={modo === 'dia' ? [ref] : dias} hoy={hoy} citas={citas} ocupado={ocupado} sel={sel} detalle={modo === 'dia'}
          nombre={c => (modo === 'dia' ? nombre(c) : nombre(c).split(' ')[0])} onCita={setSel} onHueco={nueva} />
      )}

      <View style={[estilos.fila, { gap: 12 }]}>
        {([['programada', 'Programada'], ['pagada', 'Pagada (P)'], ['sinPagar', 'Realizada sin pagar'], ['cobrarAusencia', 'Cancelada <24 h o ausencia'], ['cancelada', 'Cancelada a tiempo']] as [Aspecto, string][]).map(([a, t]) => (
          <View key={a} style={estilos.fila}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: a === 'pagada' ? colores.ok : ASPECTO[a].texto }} />
            <Text style={estilos.meta}>{t}</Text>
          </View>
        ))}
        {ocupado.length > 0 && <Text style={estilos.meta}>Gris: otros compromisos de tu calendario.</Text>}
      </View>

      {movil && (
        <Modal visible={!!ficha} transparent animationType="slide" onRequestClose={() => setSel(null)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0004' }} onPress={() => setSel(null)} accessibilityLabel="Cerrar" />
          <View style={{ padding: 12, paddingBottom: 12 + abajo, backgroundColor: colores.fondo }}>{ficha}</View>
        </Modal>
      )}
    </ScrollView>
  );
}

// En la web el toque no trae locationY: se calcula con la posición del dedo dentro de la columna.
const alturaToque = (e: GestureResponderEvent) => e.nativeEvent.locationY
  ?? (e.nativeEvent as unknown as MouseEvent).clientY - (e.currentTarget as unknown as HTMLElement).getBoundingClientRect().top;

function Rejilla({ dias, hoy, citas, ocupado, sel, detalle, nombre, onCita, onHueco }: {
  dias: string[]; hoy: string; citas: Cita[]; ocupado: Ocupado[]; sel: string | null; detalle: boolean;
  nombre: (c: Cita) => string; onCita: (id: string) => void; onHueco: (fecha: string, hora: string) => void;
}) {
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const alto = horas.length * PX_HORA;
  return (
    <View style={{ backgroundColor: colores.superficie, borderRadius: 12, borderWidth: 1, borderColor: colores.linea, overflow: 'hidden' }}>
      {dias.length > 1 && (
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colores.linea }}>
          <View style={{ width: 48 }} />
          {dias.map(d => {
            const x = parseFecha(d);
            return (
              <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
                <Text style={estilos.meta}>{DIAS[x.getDay()]}</Text>
                <Text style={{ fontSize: 17, fontWeight: d === hoy ? '700' : '500', color: d === hoy ? colores.acento : colores.tinta }}>{x.getDate()}</Text>
              </View>
            );
          })}
        </View>
      )}
      <View style={{ flexDirection: 'row', paddingTop: 8 }}>
        {/* Las horas suben 7 px para quedar centradas en su línea (una sola vez, no en cada hora). */}
        <View style={{ width: 48, marginTop: -7 }}>
          {horas.map(h => <Text key={h} style={{ height: PX_HORA, fontSize: 11, color: colores.suave, textAlign: 'right', paddingRight: 6 }}>{String(h).padStart(2, '0')}:00</Text>)}
        </View>
        {dias.map(d => (
          <Pressable key={d} onPress={e => onHueco(d, horaEnPunto(alturaToque(e), PX_HORA))} accessibilityLabel={`Crear cita el ${fechaLarga(d)}`}
            style={{ flex: 1, height: alto, borderLeftWidth: 1, borderColor: colores.linea }}>
            {horas.map(h => <View key={h} pointerEvents="none" style={{ height: PX_HORA, borderTopWidth: 1, borderColor: colores.linea }} />)}
            {ocupado.filter(o => o.fecha === d).map((o, i) => {
              const p = posicion(o.hora, o.duracionMin, PX_HORA);
              return (
                <View key={`o${i}`} pointerEvents="none" style={{ position: 'absolute', left: 2, right: 2, ...p, borderRadius: 6, backgroundColor: colores.linea, opacity: 0.7, padding: 3 }}>
                  {detalle && <Text numberOfLines={1} style={{ fontSize: 11, color: colores.suave }}>Ocupado · {o.titulo}</Text>}
                </View>
              );
            })}
            {citas.filter(c => c.fecha === d).map(c => {
              const a = ASPECTO[aspectoCita(c)];
              return (
                <Pressable key={c.id} onPress={() => onCita(c.id)} accessibilityRole="button" accessibilityLabel={`${nombre(c)}, ${c.hora}, ${ESTADOS[c.estado]}${c.pagada ? ', pagada' : ''}`}
                  style={{ position: 'absolute', left: 3, right: 3, ...posicion(c.hora, c.duracionMin, PX_HORA), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
                    backgroundColor: a.fondo, borderLeftWidth: 3, borderLeftColor: a.texto, borderWidth: sel === c.id ? 2 : 0, borderColor: colores.tinta, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: '600', color: a.texto, textDecorationLine: c.estado === 'cancelada' ? 'line-through' : 'none' }}>{nombre(c)}</Text>
                    {c.pagada && <Text style={{ fontSize: 13, fontWeight: '800', color: a.texto }}>P</Text>}
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: a.texto }}>{c.hora}{detalle ? ` · ${c.duracionMin} min · ${ESTADOS[c.estado]}` : ''}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Mes({ dias, referencia, hoy, citas, nombre, compacto, onDia }: {
  dias: string[]; referencia: string; hoy: string; citas: Cita[]; nombre: (c: Cita) => string; compacto: boolean; onDia: (d: string) => void;
}) {
  const mes = referencia.slice(0, 7);
  return (
    <View style={{ backgroundColor: colores.superficie, borderRadius: 12, borderWidth: 1, borderColor: colores.linea, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        {['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => <Text key={d} style={[estilos.meta, { flex: 1, textAlign: 'center', paddingVertical: 6 }]}>{d}</Text>)}
      </View>
      {[0, 1, 2, 3, 4, 5].map(s => (
        <View key={s} style={{ flexDirection: 'row' }}>
          {dias.slice(s * 7, s * 7 + 7).map(d => {
            const lista = citas.filter(c => c.fecha === d).sort((a, b) => a.hora.localeCompare(b.hora));
            const fuera = d.slice(0, 7) !== mes;
            return (
              <Pressable key={d} onPress={() => onDia(d)} accessibilityRole="button" accessibilityLabel={`${fechaLarga(d)}, ${lista.length} sesiones`}
                style={{ flex: 1, minHeight: compacto ? 56 : 92, padding: 3, gap: 3, borderTopWidth: 1, borderLeftWidth: 1, borderColor: colores.linea, backgroundColor: fuera ? colores.fondo : colores.superficie }}>
                <Text style={{ fontSize: 12, fontWeight: d === hoy ? '800' : '400', color: d === hoy ? colores.acento : fuera ? colores.suave : colores.tinta }}>{parseFecha(d).getDate()}</Text>
                {lista.slice(0, 3).map(c => {
                  const a = ASPECTO[aspectoCita(c)];
                  // En el móvil no cabe el texto: una barra del color del estado.
                  return compacto
                    ? <View key={c.id} style={{ height: 6, borderRadius: 3, backgroundColor: aspectoCita(c) === 'pagada' ? colores.ok : a.texto, opacity: c.estado === 'cancelada' ? 0.35 : 1 }} />
                    : (
                      <View key={c.id} style={{ flexDirection: 'row', backgroundColor: a.fondo, borderRadius: 4, paddingHorizontal: 3 }}>
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, color: a.texto }}>{c.hora} {nombre(c).split(' ')[0]}</Text>
                        {c.pagada && <Text style={{ fontSize: 10, fontWeight: '800', color: a.texto }}>P</Text>}
                      </View>
                    );
                })}
                {lista.length > 3 && <Text style={{ fontSize: 10, color: colores.suave }}>+{lista.length - 3}</Text>}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
