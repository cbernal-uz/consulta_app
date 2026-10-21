import { createElement } from 'react';
import { Text, View } from 'react-native';
import { colores, estilos } from './componentes';

/** En la web, un <input type="date"> o "time": en el iPhone abre la rueda de fecha u hora del sistema. */
export function CampoFecha({ etiqueta, tipo, value, onChange }: { etiqueta: string; tipo: 'fecha' | 'hora'; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 4, flex: 1, minWidth: 140 }}>
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      {createElement('input', {
        type: tipo === 'fecha' ? 'date' : 'time',
        value,
        step: tipo === 'hora' ? 300 : undefined,
        required: true,
        'aria-label': etiqueta,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: {
          boxSizing: 'border-box', width: '100%', minHeight: 40, padding: '8px 10px', fontSize: 16, fontFamily: 'inherit',
          color: colores.tinta, backgroundColor: colores.superficie, border: `1px solid ${colores.linea}`, borderRadius: 8,
        },
      })}
    </View>
  );
}
