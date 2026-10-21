// SQL para aplicar una fila bajada de Supabase. Gana la versión más reciente si la fila local tiene cambios sin subir.
export function sqlAplicarRemota(tabla: string, cols: string[]): string {
  return `INSERT INTO ${tabla} (${cols.join(', ')}, pendiente) VALUES (${cols.map(() => '?').join(', ')}, -1)
    ON CONFLICT(id) DO UPDATE SET ${cols.filter(x => x !== 'id').map(x => `${x} = excluded.${x}`).join(', ')}, pendiente = -1
    WHERE ${tabla}.pendiente <> 1 OR excluded.updated_at > ${tabla}.updated_at`;
}
