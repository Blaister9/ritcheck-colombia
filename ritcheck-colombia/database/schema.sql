-- ==========================================
-- ARCHIVO: database/schema.sql
-- PROPOSITO: Schema PostgreSQL/Supabase completo para RITCheck Colombia
-- DEPENDENCIAS: Supabase PostgreSQL, auth.users, storage
-- LLAMADO DESDE: Supabase SQL editor, migraciones CI/CD
-- ==========================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

do $$ begin
  create type public.plan_id as enum ('basic', 'pro', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending_payment',
    'paid',
    'uploaded',
    'processing',
    'manual_review',
    'completed',
    'failed',
    'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('bold', 'wompi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'approved', 'declined', 'voided', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_parse_status as enum ('pending', 'parsed', 'failed', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.analysis_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.model_provider as enum ('claude', 'openai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_status as enum ('queued', 'sent', 'delivered', 'bounced', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.plans (
  id public.plan_id primary key,
  name text not null,
  amount_cop integer not null check (amount_cop > 0),
  currency char(3) not null default 'COP',
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  nit text,
  employee_count integer check (employee_count is null or employee_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nit)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  plan_id public.plan_id not null references public.plans(id),
  status public.order_status not null default 'pending_payment',
  amount_cop integer not null check (amount_cop > 0),
  currency char(3) not null default 'COP',
  customer_email citext not null,
  customer_name text,
  company_name_snapshot text,
  company_nit_snapshot text,
  bold_checkout_id text,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,
  failed_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider public.payment_provider not null,
  provider_payment_id text,
  provider_reference text,
  status public.payment_status not null default 'pending',
  amount_cop integer not null check (amount_cop > 0),
  currency char(3) not null default 'COP',
  raw_event jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  storage_bucket text not null,
  storage_path text not null,
  parse_status public.document_parse_status not null default 'pending',
  text_word_count integer,
  uploaded_at timestamptz not null default now(),
  delete_after timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  status public.analysis_status not null default 'queued',
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  failed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_model_runs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  analysis_job_id uuid references public.analysis_jobs(id) on delete set null,
  provider public.model_provider not null,
  model text not null,
  prompt_version text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  latency_ms integer,
  status public.analysis_status not null,
  error_code text,
  raw_response_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  executive_summary text not null,
  findings jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  model_usage jsonb not null default '[]'::jsonb,
  requires_manual_review boolean not null default true,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  version integer not null default 1,
  sha256 text,
  generated_at timestamptz not null default now(),
  signed_url_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, version),
  unique (storage_bucket, storage_path)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  template text not null,
  recipient citext not null,
  provider_message_id text,
  status public.email_status not null default 'queued',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table if not exists public.document_retention_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  delete_after timestamptz not null,
  status public.analysis_status not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at before update on public.plans for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at before update on public.companies for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();

drop trigger if exists analysis_jobs_set_updated_at on public.analysis_jobs;
create trigger analysis_jobs_set_updated_at before update on public.analysis_jobs for each row execute function public.set_updated_at();

drop trigger if exists analysis_results_set_updated_at on public.analysis_results;
create trigger analysis_results_set_updated_at before update on public.analysis_results for each row execute function public.set_updated_at();

drop trigger if exists email_events_set_updated_at on public.email_events;
create trigger email_events_set_updated_at before update on public.email_events for each row execute function public.set_updated_at();

drop trigger if exists document_retention_jobs_set_updated_at on public.document_retention_jobs;
create trigger document_retention_jobs_set_updated_at before update on public.document_retention_jobs for each row execute function public.set_updated_at();

create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_customer_email on public.orders(customer_email);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_documents_order_id on public.documents(order_id);
create index if not exists idx_documents_delete_after on public.documents(delete_after) where deleted_at is null;
create index if not exists idx_analysis_jobs_status on public.analysis_jobs(status);
create index if not exists idx_ai_model_runs_order_id on public.ai_model_runs(order_id);
create index if not exists idx_reports_order_id on public.reports(order_id);
create index if not exists idx_order_events_order_id on public.order_events(order_id);
create index if not exists idx_email_events_order_id on public.email_events(order_id);
create index if not exists idx_document_retention_due on public.document_retention_jobs(delete_after) where status in ('queued', 'failed');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('rit-documents', 'rit-documents', false, 15728640, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('reports', 'reports', false, 15728640, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- TODO: agregar migracion de busqueda full-text si se necesita auditoria textual interna sin exponer documento completo.
