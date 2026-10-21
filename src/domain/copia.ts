// Copia de seguridad: un JSON con todas las filas de cada tabla.

export const TABLAS_COPIA = ['terapeuta', 'pacientes', 'facturas', 'citas', 'lineas_factura'] as const;
export type TablaCopia = (typeof TABLAS_COPIA)[number];
type Fila = Record<string, unknown>;

export interface Copia {
  app: 'consulta';
  version: 1;
  creada: string; // ISO
  tablas: Record<TablaCopia, Fila[]>;
}

export function crearCopia(tablas: Record<TablaCopia, Fila[]>, creada: Date): Copia {
  return { app: 'consulta', version: 1, creada: creada.toISOString(), tablas };
}

/** Comprueba que el archivo es una copia de esta app antes de restaurarla. */
export function validarCopia(datos: unknown): Copia {
  const c = datos as Partial<Copia> | null;
  if (!c || c.app !== 'consulta' || !c.tablas) throw new Error('El archivo no es una copia de seguridad de Consulta.');
  if (c.version !== 1) throw new Error('La copia es de una versión de la app que esta no reconoce.');
  for (const t of TABLAS_COPIA) {
    const filas = c.tablas[t];
    if (!Array.isArray(filas) || filas.some(f => typeof f !== 'object' || f === null || !('id' in f))) {
      throw new Error(`La copia está incompleta: falta la tabla ${t}.`);
    }
  }
  return c as Copia;
}

export function nombreCopia(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `Consulta copia ${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())} ${p(fecha.getHours())}${p(fecha.getMinutes())}.json`;
}

export function resumenCopia(c: Copia): string {
  const n = (t: TablaCopia) => c.tablas[t].length;
  return `${n('pacientes')} pacientes, ${n('citas')} sesiones y ${n('facturas')} facturas`;
}
