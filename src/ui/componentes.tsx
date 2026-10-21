import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const colores = {
  fondo: '#f5f6f4',
  superficie: '#ffffff',
  tinta: '#1d2a2f',
  suave: '#5d6b70',
  linea: '#dde2df',
  acento: '#2f6f6a',
  acentoSuave: '#e2efed',
  ok: '#2e7d4f',
  okSuave: '#e3f2e8',
  aviso: '#a8641a',
  avisoSuave: '#fbefdf',
  mal: '#a83a3a',
  malSuave: '#f8e4e4',
};

export function Boton({ titulo, onPress, secundario, desactivado }: { titulo: string; onPress: () => void; secundario?: boolean; desactivado?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={desactivado}
      style={({ pressed }) => [estilos.boton, secundario && estilos.botonSec, (pressed || desactivado) && { opacity: 0.6 }]}
    >
      <Text style={[estilos.botonTexto, secundario && { color: colores.acento }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Chip({ texto, activo, onPress, tono = 'acento' }: { texto: string; activo?: boolean; onPress?: () => void; tono?: 'acento' | 'ok' | 'aviso' | 'mal' }) {
  const fondo = { acento: colores.acentoSuave, ok: colores.okSuave, aviso: colores.avisoSuave, mal: colores.malSuave }[tono];
  const color = { acento: colores.acento, ok: colores.ok, aviso: colores.aviso, mal: colores.mal }[tono];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[estilos.chip, activo ? { backgroundColor: fondo, borderColor: color } : null]}>
      <Text style={{ color: activo ? color : colores.suave, fontWeight: '600', fontSize: 13 }}>{texto}</Text>
    </Pressable>
  );
}

export function Casilla({ texto, marcada, onCambio }: { texto: string; marcada: boolean; onCambio: (v: boolean) => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: marcada }} onPress={() => onCambio(!marcada)} style={[estilos.fila, { flexWrap: 'nowrap' }]}>
      <View style={[estilos.casilla, marcada && { backgroundColor: colores.acento, borderColor: colores.acento }]}>
        {marcada && <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14 }}>✓</Text>}
      </View>
      <Text style={{ color: colores.tinta, flex: 1 }}>{texto}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: TextInputProps & { etiqueta: string }) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput accessibilityLabel={etiqueta} placeholderTextColor={colores.suave} style={estilos.input} {...props} />
    </View>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return <View style={estilos.tarjeta}>{children}</View>;
}

export const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 40 },
  titulo: { fontSize: 24, fontWeight: '700', color: colores.tinta },
  sub: { color: colores.suave },
  etiqueta: { fontSize: 12, fontWeight: '600', color: colores.suave },
  // 16 px como mínimo: con menos, Safari en el iPhone amplía la pantalla al escribir.
  input: { borderWidth: 1, borderColor: colores.linea, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colores.superficie, color: colores.tinta, fontSize: 16 },
  tarjeta: { backgroundColor: colores.superficie, borderRadius: 12, borderWidth: 1, borderColor: colores.linea, padding: 14, gap: 10 },
  fila: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  boton: { backgroundColor: colores.acento, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  botonSec: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colores.acento },
  botonTexto: { color: '#ffffff', fontWeight: '700' },
  casilla: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colores.suave, alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1, borderColor: colores.linea, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  nombre: { fontWeight: '600', color: colores.tinta, fontSize: 15 },
  meta: { color: colores.suave, fontSize: 13 },
  num: { fontVariant: ['tabular-nums'], color: colores.tinta },
});
