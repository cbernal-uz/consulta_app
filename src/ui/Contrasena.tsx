import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { Boton, Campo, colores, estilos } from './componentes';

/** Ventana para pedir la contraseña de la copia. Al crearla se pide dos veces. */
export function PedirContrasena({ visible, titulo, explicacion, repetir, onAceptar, onCancelar }: {
  visible: boolean; titulo: string; explicacion: string; repetir?: boolean;
  onAceptar: (contrasena: string) => void; onCancelar: () => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const cerrar = (fn: () => void) => { setA(''); setB(''); fn(); };
  const error = repetir && b && a !== b ? 'Las contraseñas no coinciden.' : repetir && a && a.length < 8 ? 'Mínimo 8 caracteres.' : '';
  const valido = repetir ? a.length >= 8 && a === b : a.length > 0;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => cerrar(onCancelar)}>
      <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'center', padding: 24 }}>
        <View style={[estilos.contenido, { backgroundColor: colores.superficie, borderRadius: 12, maxWidth: 480, width: '100%', alignSelf: 'center' }]}>
          <Text style={estilos.nombre}>{titulo}</Text>
          <Text style={estilos.meta}>{explicacion}</Text>
          <Campo etiqueta="Contraseña" value={a} onChangeText={setA} secureTextEntry autoFocus />
          {repetir && <Campo etiqueta="Repite la contraseña" value={b} onChangeText={setB} secureTextEntry />}
          {!!error && <Text style={[estilos.meta, { color: colores.aviso }]}>{error}</Text>}
          <Boton titulo="Aceptar" onPress={() => cerrar(() => onAceptar(a))} desactivado={!valido} />
          <Boton titulo="Cancelar" secundario onPress={() => cerrar(onCancelar)} />
        </View>
      </View>
    </Modal>
  );
}
