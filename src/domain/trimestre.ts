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
  return [cabecera, ...filas].map(f => f.map(celda).join(';')).join('\r\n');
}
