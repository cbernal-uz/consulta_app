import type { FacturaEmitida } from './trimestre.ts';
import { porCliente, totalesTrimestre } from './trimestre.ts';

// HTML que expo-print convierte en PDF: una portada con el resumen y una página por factura.

export interface FacturaCompleta extends FacturaEmitida {
  periodo: string; // AAAA-MM
  emisor: { nombre: string; nif: string; direccion: string; colegiado: string };
  receptor: { nombre: string; nif: string; direccion: string; paciente: string; tipo: 'particular' | 'empresa' };
  lineas: { fecha: string; hora: string; duracionMin: number; concepto: string; importeCentimos: number }[];
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const eur = (c: number) => `${(c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
const fecha = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const mes = (periodo: string) => `${MESES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;

const ESTILOS = `
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1d2a2f; font-size: 10.5pt; }
  h1 { font-size: 20pt; margin: 0 0 4pt; color: #2f6f6a; }
  h2 { font-size: 13pt; margin: 18pt 0 6pt; }
  .meta { color: #5d6b70; }
  .pagina { page-break-before: always; }
  table { width: 100%; border-collapse: collapse; margin-top: 8pt; }
  th { text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #5d6b70; border-bottom: 1px solid #1d2a2f; padding: 4pt 3pt; }
  td { padding: 4pt 3pt; border-bottom: 1px solid #e4e8e6; }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .cab { display: flex; justify-content: space-between; gap: 16pt; }
  .partes { display: flex; gap: 24pt; margin: 18pt 0 6pt; }
  .partes > div { flex: 1; }
  .lbl { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #5d6b70; }
  .totales { width: 60%; margin-left: auto; margin-top: 10pt; }
  .totales td { border: 0; padding: 2pt 3pt; }
  .totales .g td { border-top: 1px solid #1d2a2f; font-weight: 700; font-size: 11.5pt; padding-top: 5pt; }
  .legal { margin-top: 18pt; font-size: 8.5pt; color: #5d6b70; }
`;

function paginaFactura(f: FacturaCompleta, primera: boolean): string {
  const e = f.emisor;
  const r = f.receptor;
  return `<section class="${primera ? '' : 'pagina'}">
    <div class="cab">
      <div><h1>Factura</h1><div>Nº <b>${esc(f.numero)}</b></div><div>Fecha: ${fecha(f.fecha)}</div><div>Periodo: ${mes(f.periodo)}</div></div>
      <div style="text-align:right"><b>${esc(e.nombre)}</b><br>Psicóloga sanitaria · Col. ${esc(e.colegiado)}<br>NIF ${esc(e.nif)}<br>${esc(e.direccion)}</div>
    </div>
    <div class="partes">
      <div><div class="lbl">Cliente</div><b>${esc(r.nombre)}</b><br>NIF ${esc(r.nif || '—')}<br>${esc(r.direccion)}</div>
      ${r.tipo === 'empresa' ? `<div><div class="lbl">Paciente atendido</div>${esc(r.paciente)}</div>` : ''}
    </div>
    <table>
      <thead><tr><th>Fecha</th><th>Hora</th><th>Concepto</th><th class="r">Duración</th><th class="r">Importe</th></tr></thead>
      <tbody>${f.lineas.map(l => `<tr><td>${fechaCorta(l.fecha)}</td><td>${l.hora}</td><td>${esc(l.concepto)}</td><td class="r">${l.duracionMin} min</td><td class="r">${eur(l.importeCentimos)}</td></tr>`).join('')}</tbody>
    </table>
    <table class="totales">
      <tr><td>Base imponible</td><td class="r">${eur(f.baseCentimos)}</td></tr>
      <tr><td>IVA (exento)</td><td class="r">${eur(0)}</td></tr>
      ${f.retencionCentimos ? `<tr><td>Retención IRPF ${String(f.retencionPct).replace('.', ',')} %</td><td class="r">−${eur(f.retencionCentimos)}</td></tr>` : ''}
      <tr class="g"><td>Total a pagar</td><td class="r">${eur(f.totalCentimos)}</td></tr>
    </table>
    <p class="legal">Operación exenta de IVA según el art. 20.Uno.3º de la Ley 37/1992 (asistencia sanitaria prestada por profesional sanitario).${f.retencionCentimos ? ' Retención de IRPF aplicada por ser el cliente una entidad.' : ''}</p>
  </section>`;
}

export function nombreArchivoTrimestre(anio: number, trimestre: number, emisor: string): string {
  return `Facturas ${trimestre}T ${anio} - ${emisor}.pdf`.replace(/[\\/:*?"<>|]/g, '');
}

/** Un solo documento: portada con el libro del trimestre y, detrás, cada factura en su página. */
export function htmlFacturasTrimestre(facturas: FacturaCompleta[], anio: number, trimestre: number): string {
  const orden = [...facturas].sort((a, b) => a.numero.localeCompare(b.numero));
  const t = totalesTrimestre(orden);
  const emisor = orden[0]?.emisor;
  const portada = `<section>
    <h1>Facturas emitidas · ${trimestre}º trimestre ${anio}</h1>
    ${emisor ? `<div class="meta">${esc(emisor.nombre)} · NIF ${esc(emisor.nif)} · Col. ${esc(emisor.colegiado)}</div>` : ''}
    <table>
      <thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>NIF</th><th class="r">Base</th><th class="r">Retención</th><th class="r">Total</th></tr></thead>
      <tbody>${orden.map(f => `<tr><td>${esc(f.numero)}</td><td>${fechaCorta(f.fecha)}</td><td>${esc(f.clienteNombre)}</td><td>${esc(f.clienteNif || '—')}</td><td class="r">${eur(f.baseCentimos)}</td><td class="r">${f.retencionCentimos ? eur(f.retencionCentimos) : '—'}</td><td class="r">${eur(f.totalCentimos)}</td></tr>`).join('')}
      <tr><td colspan="4"><b>Total (${orden.length} facturas)</b></td><td class="r"><b>${eur(t.base)}</b></td><td class="r"><b>${eur(t.retencion)}</b></td><td class="r"><b>${eur(t.total)}</b></td></tr></tbody>
    </table>
    <h2>Por cliente</h2>
    <table>
      <thead><tr><th>Cliente</th><th>NIF</th><th>Facturas</th><th class="r">Base</th><th class="r">Retención</th><th class="r">Total</th></tr></thead>
      <tbody>${porCliente(orden).map(g => `<tr><td>${esc(g.clienteNombre)}</td><td>${esc(g.clienteNif || '—')}</td><td>${g.facturas.map(f => esc(f.numero)).join(', ')}</td><td class="r">${eur(g.base)}</td><td class="r">${eur(g.retencion)}</td><td class="r">${eur(g.total)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="legal">Todas las operaciones están exentas de IVA (art. 20.Uno.3º Ley 37/1992).</p>
  </section>`;
  const paginas = orden.map(f => paginaFactura(f, false)).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${ESTILOS}</style></head><body>${portada}${paginas}</body></html>`;
}
