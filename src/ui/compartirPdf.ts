import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

/** Convierte el HTML en PDF y abre el menú de compartir. */
export async function compartirPdf(html: string, nombre: string, titulo: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const destino = new File(Paths.cache, nombre);
  if (destino.exists) destino.delete();
  new File(uri).move(destino);
  await Sharing.shareAsync(destino.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: titulo });
}
