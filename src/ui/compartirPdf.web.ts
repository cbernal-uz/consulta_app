/**
 * En la web se abre el diálogo de imprimir con el documento. Desde ahí se guarda como PDF
 * (en el iPhone: Compartir › Guardar en Archivos; en el ordenador: Destino › Guardar como PDF).
 */
export async function compartirPdf(html: string, nombre: string, _titulo: string): Promise<void> {
  const marco = document.createElement('iframe');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  // El título del documento es el nombre que el navegador propone para el PDF.
  const titulo = nombre.replace(/\.pdf$/i, '').replace(/[&<>]/g, '');
  marco.srcdoc = html.replace('<head>', `<head><title>${titulo}</title>`);
  await new Promise<void>(listo => { marco.onload = () => listo(); document.body.appendChild(marco); });
  const titulo0 = document.title;
  document.title = titulo;
  marco.contentWindow!.focus();
  marco.contentWindow!.print();
  document.title = titulo0;
  setTimeout(() => marco.remove(), 60_000);
}
