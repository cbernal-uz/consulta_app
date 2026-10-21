import { Campo } from './componentes';

/** Fecha (AAAA-MM-DD) u hora (HH:MM) escrita a mano. En la web se usa el selector del navegador (CampoFecha.web.tsx). */
export function CampoFecha({ etiqueta, tipo, value, onChange }: { etiqueta: string; tipo: 'fecha' | 'hora'; value: string; onChange: (v: string) => void }) {
  return <Campo etiqueta={`${etiqueta} (${tipo === 'fecha' ? 'AAAA-MM-DD' : 'HH:MM'})`} value={value} onChangeText={onChange} />;
}
