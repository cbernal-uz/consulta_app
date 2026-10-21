/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { MIGRACIONES } from '../schema.ts';
import { sqlAplicarRemota } from '../sqlSincronizacion.ts';

function nuevaDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const m of MIGRACIONES) db.exec(m);
  return db;
}
const pendiente = (db: DatabaseSync) => db.prepare("SELECT nombre, pendiente FROM pacientes WHERE id = 'p1'").get() as { nombre: string; pendiente: number };

test('los cambios locales quedan pendientes y los bajados no', () => {
  const db = nuevaDb();
  db.exec(`INSERT INTO pacientes (id, nombre, precio_centimos, tipo, updated_at) VALUES ('p1', 'Ana', 6000, 'particular', '2026-10-21T10:00:00Z')`);
  assert.equal(pendiente(db).pendiente, 1);
  db.exec(`UPDATE pacientes SET pendiente = 0 WHERE id = 'p1'`);
  db.exec(`UPDATE pacientes SET nombre = 'Ana B', updated_at = '2026-10-21T11:00:00Z' WHERE id = 'p1'`);
  assert.deepEqual({ ...pendiente(db) }, { nombre: 'Ana B', pendiente: 1 });

  const cols = (db.prepare('PRAGMA table_info(pacientes)').all() as { name: string }[]).map(c => c.name).filter(n => n !== 'pendiente');
  const aplicar = (nombre: string, updated_at: string) => {
    const f: Record<string, string | number> = { id: 'p1', nombre, email: '', telefono: '', precio_centimos: 6000, tipo: 'particular', fiscal_nombre: '', fiscal_nif: '', fiscal_direccion: '', activo: 1, sin_factura: 0, updated_at };
    db.prepare(sqlAplicarRemota('pacientes', cols)).run(...cols.map(c => f[c]));
    db.exec('UPDATE pacientes SET pendiente = 0 WHERE pendiente = -1');
  };
  aplicar('Remota antigua', '2026-10-21T10:30:00Z');
  assert.deepEqual({ ...pendiente(db) }, { nombre: 'Ana B', pendiente: 1 }, 'el cambio local más reciente se conserva');
  aplicar('Remota nueva', '2026-10-21T12:00:00Z');
  assert.deepEqual({ ...pendiente(db) }, { nombre: 'Remota nueva', pendiente: 0 }, 'gana la versión más reciente y no se vuelve a subir');
});
