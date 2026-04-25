-- ==========================================
-- ARCHIVO: database/rls-policies.sql
-- PROPOSITO: Politicas RLS de Supabase para proteger ordenes, documentos y reportes
-- DEPENDENCIAS: schema.sql, auth.uid(), auth.jwt()
-- LLAMADO DESDE: Supabase SQL editor, migraciones CI/CD
-- ==========================================

alter table public.plans enable row level security;
alter table public.companies enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.analysis_jobs enable row level security;
alter table public.ai_model_runs enable row level security;
alter table public.analysis_results enable row level security;
alter table public.reports enable row level security;
alter table public.order_events enable row level security;
alter table public.email_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.document_retention_jobs enable row level security;

create or replace function public.jwt_email()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'email', '')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create or replace function public.can_access_order(target_order_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and (
        o.user_id = auth.uid()
        or lower(o.customer_email::text) = lower(public.jwt_email())
        or public.is_admin()
      )
  )
$$;

drop policy if exists "plans are readable" on public.plans;
create policy "plans are readable"
on public.plans for select
using (active = true);

drop policy if exists "companies owner can read" on public.companies;
create policy "companies owner can read"
on public.companies for select
using (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "companies owner can insert" on public.companies;
create policy "companies owner can insert"
on public.companies for insert
with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "companies owner can update" on public.companies;
create policy "companies owner can update"
on public.companies for update
using (owner_user_id = auth.uid() or public.is_admin())
with check (owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "orders owner can read" on public.orders;
create policy "orders owner can read"
on public.orders for select
using (user_id = auth.uid() or lower(customer_email::text) = lower(public.jwt_email()) or public.is_admin());

drop policy if exists "orders authenticated can insert own" on public.orders;
create policy "orders authenticated can insert own"
on public.orders for insert
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders admin can update" on public.orders;
create policy "orders admin can update"
on public.orders for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "payments owner can read" on public.payments;
create policy "payments owner can read"
on public.payments for select
using (public.can_access_order(order_id));

drop policy if exists "documents owner can read metadata" on public.documents;
create policy "documents owner can read metadata"
on public.documents for select
using (public.can_access_order(order_id));

drop policy if exists "analysis results owner can read completed" on public.analysis_results;
create policy "analysis results owner can read completed"
on public.analysis_results for select
using (public.can_access_order(order_id));

drop policy if exists "reports owner can read metadata" on public.reports;
create policy "reports owner can read metadata"
on public.reports for select
using (public.can_access_order(order_id));

drop policy if exists "order events owner can read" on public.order_events;
create policy "order events owner can read"
on public.order_events for select
using (public.can_access_order(order_id));

drop policy if exists "email events owner can read" on public.email_events;
create policy "email events owner can read"
on public.email_events for select
using (order_id is not null and public.can_access_order(order_id));

drop policy if exists "admin read ai model runs" on public.ai_model_runs;
create policy "admin read ai model runs"
on public.ai_model_runs for select
using (public.is_admin());

drop policy if exists "admin read analysis jobs" on public.analysis_jobs;
create policy "admin read analysis jobs"
on public.analysis_jobs for select
using (public.is_admin());

drop policy if exists "admin read webhook events" on public.webhook_events;
create policy "admin read webhook events"
on public.webhook_events for select
using (public.is_admin());

drop policy if exists "admin read retention jobs" on public.document_retention_jobs;
create policy "admin read retention jobs"
on public.document_retention_jobs for select
using (public.is_admin());

-- Storage: el backend usa service role para subir, descargar, firmar y borrar.
-- Los clientes no deben leer documentos RIT directamente. Los reportes se entregan con signed URL.
drop policy if exists "deny client rit document reads" on storage.objects;

drop policy if exists "allow owner report reads" on storage.objects;
create policy "allow owner report reads"
on storage.objects for select
using (
  bucket_id = 'reports'
  and exists (
    select 1
    from public.reports r
    where r.storage_path = storage.objects.name
      and public.can_access_order(r.order_id)
  )
);

-- TODO: si el frontend sube directo a Supabase Storage, reemplazar estas politicas por signed upload URLs de corta duracion.
-- TODO: probar RLS con usuario anonimo, autenticado cliente, admin y service_role antes de produccion.
