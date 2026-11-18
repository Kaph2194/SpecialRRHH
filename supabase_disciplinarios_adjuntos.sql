-- ═══════════════════════════════════════════════════════════════
-- SPECIAL RRHH — ADJUNTOS DEL EXPEDIENTE DISCIPLINARIO
-- Ejecutar completo en: Supabase → SQL Editor → Run
--
-- Cada proceso disciplinario tiene 4 carpetas de adjuntos:
--   apertura · acta · cierre · sancion
-- Varios archivos por carpeta, máximo 10 MB cada uno.
--
-- SOLO Super Admin, Analista RRHH y Líder RRHH pueden subir, ver,
-- descargar o borrar estos archivos. El bucket es PRIVADO: no hay
-- enlace público; la app pide un enlace temporal (2 minutos) cada
-- vez que alguien autorizado abre un archivo.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. ¿Quién puede gestionar el expediente? ────────────────
create or replace function public.fn_gestiona_expediente_disc()
  returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.perfiles
     where user_id = auth.uid()
       and rol in ('superadmin','analista_rrhh','lider_rrhh')
       and coalesce(activo, true)
  )
$$;
revoke all on function public.fn_gestiona_expediente_disc() from public;
grant execute on function public.fn_gestiona_expediente_disc() to authenticated;

-- ─── 2. Tabla de adjuntos ────────────────────────────────────
create table if not exists public.disciplinario_adjuntos (
  id          text primary key,
  disc_id     text not null,
  etapa       text not null check (etapa in ('apertura','acta','cierre','sancion')),
  nombre      text not null,
  ruta        text not null,          -- ruta dentro del bucket 'disciplinarios'
  tamano      bigint default 0,       -- bytes
  tipo_mime   text default '',
  subido_por  text default '',
  created_at  timestamptz default now()
);
create index if not exists disciplinario_adjuntos_disc_idx
  on public.disciplinario_adjuntos (disc_id, etapa);

alter table public.disciplinario_adjuntos enable row level security;

drop policy if exists "disc_adj_sel" on public.disciplinario_adjuntos;
drop policy if exists "disc_adj_ins" on public.disciplinario_adjuntos;
drop policy if exists "disc_adj_del" on public.disciplinario_adjuntos;
create policy "disc_adj_sel" on public.disciplinario_adjuntos
  for select to authenticated using (public.fn_gestiona_expediente_disc());
create policy "disc_adj_ins" on public.disciplinario_adjuntos
  for insert to authenticated with check (public.fn_gestiona_expediente_disc());
create policy "disc_adj_del" on public.disciplinario_adjuntos
  for delete to authenticated using (public.fn_gestiona_expediente_disc());

-- ─── 3. Bucket privado con límite de 10 MB por archivo ───────
insert into storage.buckets (id, name, public, file_size_limit)
values ('disciplinarios', 'disciplinarios', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "disc_storage_sel" on storage.objects;
drop policy if exists "disc_storage_ins" on storage.objects;
drop policy if exists "disc_storage_del" on storage.objects;
create policy "disc_storage_sel" on storage.objects
  for select to authenticated
  using (bucket_id = 'disciplinarios' and public.fn_gestiona_expediente_disc());
create policy "disc_storage_ins" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'disciplinarios' and public.fn_gestiona_expediente_disc());
create policy "disc_storage_del" on storage.objects
  for delete to authenticated
  using (bucket_id = 'disciplinarios' and public.fn_gestiona_expediente_disc());

select pg_notify('pgrst', 'reload schema');

-- ─── Verificar ───────────────────────────────────────────────
-- select id, public, file_size_limit from storage.buckets where id = 'disciplinarios';
--   → public = false, file_size_limit = 10485760
-- select count(*) from public.disciplinario_adjuntos;
