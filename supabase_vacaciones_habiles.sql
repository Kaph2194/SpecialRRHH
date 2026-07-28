-- ─── VACACIONES: columnas de período y días calendario ──────
alter table public.vacaciones add column if not exists periodo         text;
alter table public.vacaciones add column if not exists dias_calendario numeric;
alter table public.horarios   add column if not exists horas_semana    numeric;
select pg_notify('pgrst', 'reload schema');

-- ─── HORARIOS: mes de última actualización (alerta mensual) ──
alter table public.horarios add column if not exists mes_actualizado text;
select pg_notify('pgrst', 'reload schema');
