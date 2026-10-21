// Libro de facturas emitidas por trimestre, para enviar a la gestoría.

export interface FacturaEmitida {
  numero: string;
  fecha: string; // AAAA-MM-DD
  clienteNombre: string;
  clienteNif: string;
  baseCentimos: number;
  retencionPct: number;
  retencionCentimos: number;
  totalCentimos: number;
}

export function rangoTrimestre(anio: number, trimestre: 1 | 2 | 3 | 4): { desde: string; hasta: string } {
  const mesIni = (trimestre - 1) * 3 + 1;
  const mesFin = mesIni + 2;
  const ultimoDia = new Date(anio, mesFin, 0).getDate();
  const mm = (m: number) => String(m).padStart(2, '0');
  return { desde: `${anio}-${mm(mesIni)}-01`, hasta: `${anio}-${mm(mesFin)}-${ultimoDia}` };
}

export function trimestreDe(iso: string): { anio: number; trimestre: 1 | 2 | 3 | 4 } {
  const mes = Number(iso.slice(5, 7));
  return { anio: Number(iso.slice(0, 4)), trimestre: (Math.floor((mes - 1) / 3) + 1) as 1 | 2 | 3 | 4 };
}

export function totalesTrimestre(facturas: FacturaEmitida[]) {
  return facturas.reduce(
    (t, f) => ({
      base: t.base + f.baseCentimos,
      retencion: t.retencion + f.retencionCentimos,
      total: t.total + f.totalCentimos,
    }),
    { base: 0, retencion: 0, total: 0 },
  );
}

export interface ResumenCliente {
  clienteNombre: string;
  clienteNif: string;
  facturas: FacturaEmitida[];
  base: number;
  retencion: number;
  total: number;
}

/** Facturas del trimestre agrupadas por cliente, de mayor a menor importe. */
export function porCliente(facturas: FacturaEmitida[]): ResumenCliente[] {
  const grupos = new Map<string, FacturaEmitida[]>();
  for (const f of facturas) {
    const clave = f.clienteNif || f.clienteNombre;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }
  return [...grupos.values()]
    .map(fs => {
      const t = totalesTrimestre(fs);
      return {
        clienteNombre: fs[0].clienteNombre, clienteNif: fs[0].clienteNif,
        facturas: [...fs].sort((a, b) => a.numero.localeCompare(b.numero)),
        base: t.base, retencion: t.retencion, total: t.total,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export interface IngresoSinFactura {
  paciente: string;
  sesiones: number;
  importeCentimos: number;
}

const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const celda = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV con separador «;» y decimales con coma, como lo abre Excel en español. */
export function csvLibroFacturas(facturas: FacturaEmitida[]): string {
  const cabecera = ['Número', 'Fecha', 'Cliente', 'NIF', 'Base imponible', 'Tipo IVA', 'Cuota IVA', 'Retención %', 'Retención', 'Total'];
  const filas = [...facturas]
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map(f => [
      f.numero, f.fecha, f.clienteNombre, f.clienteNif, euros(f.baseCentimos), 'Exenta', '0,00',
      String(f.retencionPct).replace('.', ','), euros(f.retencionCentimos), euros(f.totalCentimos),
    ]);
  const t = totalesTrimestre(facturas);
  filas.push(['TOTAL', '', '', '', euros(t.base), '', '0,00', '', euros(t.retencion), euros(t.total)]);
  const lineas = [cabecera, ...filas];
  lineas.push([], ['Resumen por cliente'], ['Cliente', 'NIF', 'Facturas', 'Base imponible', 'Retención', 'Total']);
  for (const g of porCliente(facturas)) {
    lineas.push([g.clienteNombre, g.clienteNif, g.facturas.map(f => f.numero).join(' '), euros(g.base), euros(g.retencion), euros(g.total)]);
  }
  return lineas.map(f => f.map(celda).join(';')).join('\r\n');
}

/** Archivo aparte con los cobros de pacientes a los que no se emite factura. */
export function csvIngresosSinFactura(ingresos: IngresoSinFactura[]): string {
  const lineas = [['Paciente', 'Sesiones', 'Importe']];
  for (const i of ingresos) lineas.push([i.paciente, String(i.sesiones), euros(i.importeCentimos)]);
  lineas.push(['TOTAL', String(ingresos.reduce((s, i) => s + i.sesiones, 0)), euros(ingresos.reduce((s, i) => s + i.importeCentimos, 0))]);
  return lineas.map(f => f.map(celda).join(';')).join('\r\n');
}
