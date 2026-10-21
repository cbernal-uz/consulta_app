// Importes en céntimos para evitar errores de redondeo.

export type TipoCliente = 'particular' | 'empresa';

export type EstadoCita =
  | 'programada'
  | 'realizada'
  | 'cancelada' // cancelada con 24 h o más de antelación: no se cobra
  | 'cancelada_tarde' // cancelada con menos de 24 h: se cobra
  | 'no_asistio'; // ausencia sin aviso: se cobra

export interface DatosFiscales {
  nombre: string;
  nif: string;
  direccion: string;
}

export interface Paciente {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  precioCentimos: number;
  tipo: TipoCliente;
  fiscal: DatosFiscales;
  activo: boolean;
  /** No se le emite factura; sus cobros constan en el trimestre como ingresos sin factura. */
  sinFactura: boolean;
}

export interface Cita {
  id: string;
  pacienteId: string;
  fecha: string; // AAAA-MM-DD
  hora: string; // HH:MM
  duracionMin: number;
  modalidad: 'presencial' | 'online';
  precioCentimos: number;
  estado: EstadoCita;
  pagada: boolean;
  metodoPago: string | null;
  fechaPago: string | null;
  facturaId: string | null;
}

export interface Terapeuta {
  nombre: string;
  nif: string;
  direccion: string;
  colegiado: string;
  email: string;
  serieFactura: string; // p. ej. "2026-"
  siguienteNumero: number;
  retencionEmpresaPct: number; // IRPF aplicado a clientes empresa
}

export interface LineaFactura {
  citaId: string;
  fecha: string;
  hora: string;
  duracionMin: number;
  concepto: string;
  importeCentimos: number;
}

export interface BorradorFactura {
  pacienteId: string;
  periodo: string; // AAAA-MM
  lineas: LineaFactura[];
  baseCentimos: number;
  retencionPct: number;
  retencionCentimos: number;
  totalCentimos: number;
}
