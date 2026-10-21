// Reglas de la copia automática diaria en Google Drive.

export const COPIAS_A_CONSERVAR = 30;

/** Toca hacer copia si no se ha hecho ninguna hoy (en la hora local de la tablet). */
export function tocaCopiaHoy(ultima: string | null, ahora: Date): boolean {
  if (!ultima) return true;
  const u = new Date(ultima);
  return u.getFullYear() !== ahora.getFullYear() || u.getMonth() !== ahora.getMonth() || u.getDate() !== ahora.getDate();
}

/** Las copias que sobran, de la más antigua a la más reciente, dejando las `conservar` últimas. */
export function copiasSobrantes<T extends { createdTime: string }>(archivos: T[], conservar = COPIAS_A_CONSERVAR): T[] {
  return [...archivos].sort((a, b) => b.createdTime.localeCompare(a.createdTime)).slice(conservar).reverse();
}

/** Cuerpo multipart/related que pide la API de Drive para subir metadatos y contenido de una vez. */
export function cuerpoMultipart(metadatos: object, contenido: string, limite: string): string {
  return [
    `--${limite}`, 'Content-Type: application/json; charset=UTF-8', '', JSON.stringify(metadatos),
    `--${limite}`, 'Content-Type: application/json', '', contenido,
    `--${limite}--`, '',
  ].join('\r\n');
}
