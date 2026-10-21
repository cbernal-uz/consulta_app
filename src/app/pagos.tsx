import { useState } from 'react';
import { View } from 'react-native';
import Facturas from '../pantallas/Facturas';
import SinCobrar from '../pantallas/SinCobrar';
import Trimestre from '../pantallas/Trimestre';
import { Chip, colores, estilos } from '../ui/componentes';

const PESTANAS = [
  { clave: 'facturas', titulo: 'Facturas', Pantalla: Facturas },
  { clave: 'sin-cobrar', titulo: 'Sin cobrar', Pantalla: SinCobrar },
  { clave: 'trimestre', titulo: 'Trimestre', Pantalla: Trimestre },
] as const;

export default function Pagos() {
  const [actual, setActual] = useState<(typeof PESTANAS)[number]['clave']>('facturas');
  const { Pantalla } = PESTANAS.find(p => p.clave === actual)!;
  return (
    <View style={estilos.pantalla}>
      <View style={[estilos.fila, { padding: 12, borderBottomWidth: 1, borderColor: colores.linea, backgroundColor: colores.superficie }]}>
        {PESTANAS.map(p => <Chip key={p.clave} texto={p.titulo} activo={p.clave === actual} onPress={() => setActual(p.clave)} />)}
      </View>
      <Pantalla />
    </View>
  );
}
