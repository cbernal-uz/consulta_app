-- Esquema de la base de datos en Supabase. Pegar entero en el SQL Editor del proyecto y ejecutar una vez.
-- Cada fila pertenece al usuario que la sube (owner) y solo ese usuario puede leerla o cambiarla.
-- «modificado» lo pone el servidor y sirve para que cada tablet baje solo lo que ha cambiado.

create table if not exists terapeuta (
  id integer primary key,
  nombre text not null default '',
  nif text not null default '',
  direccion text not null default '',
  colegiado text not null default '',
  email text not null default '',
  serie_factura text not null default '2026-',
  siguiente_numero integer not null default 1,
  retencion_empresa_pct real not null default 15,
  updated_at text not null default ''
);

create table if not exists pacientes (
  id text primary key,
  nombre text not null,
  email text not null default '',
  telefono text not null default '',
  precio_centimos integer not null,
  tipo text not null,
  fiscal_nombre text not null default '',
  fiscal_nif text not null default '',
  fiscal_direccion text not null default '',
  activo integer not null default 1,
  sin_factura integer not null default 0,
  updated_at text not null
);

create table if not exists facturas (
  id text primary key,
  numero text not null,
  paciente_id text not null,
  fecha text not null,
  periodo text not null,
  emisor_json text not null,
  receptor_json text not null,
  base_centimos integer not null,
  retencion_pct real not null,
  retencion_centimos integer not null,
  total_centimos integer not null,
  estado text not null default 'emitida',
  updated_at text not null
);

create table if not exists citas (
  id text primary key,
  paciente_id text not null,
  fecha text not null,
  hora text not null,
  duracion_min integer not null default 50,
  modalidad text not null default 'presencial',
  precio_centimos integer not null,
  estado text not null default 'programada',
  pagada integer not null default 0,
  metodo_pago text,
  fecha_pago text,
  factura_id text,
  updated_at text not null
);

create table if not exists lineas_factura (
  id text primary key,
  factura_id text not null,
  cita_id text not null,
  fecha text not null,
  hora text not null,
  duracion_min integer not null,
  concepto text not null,
  importe_centimos integer not null,
  updated_at text not null default ''
);

create or replace function marcar_modificado() returns trigger language plpgsql as $$
begin
  new.modificado := clock_timestamp();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['terapeuta', 'pacientes', 'facturas', 'citas', 'lineas_factura'] loop
    execute format('alter table %I add column if not exists owner uuid not null default auth.uid()', t);
    execute format('alter table %I add column if not exists modificado timestamptz not null default clock_timestamp()', t);
    execute format('create index if not exists %I on %I (owner, modificado)', t || '_modificado', t);
    execute format('drop trigger if exists marcar_modificado on %I', t);
    execute format('create trigger marcar_modificado before insert or update on %I for each row execute function marcar_modificado()', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists solo_propietario on %I', t);
    execute format('create policy solo_propietario on %I for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;
