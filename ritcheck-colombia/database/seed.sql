-- ==========================================
-- ARCHIVO: database/seed.sql
-- PROPOSITO: Datos iniciales de planes comerciales y configuracion MVP
-- DEPENDENCIAS: schema.sql
-- LLAMADO DESDE: Desarrollo local, Supabase seed y pruebas
-- ==========================================

insert into public.plans (id, name, amount_cop, currency, features, active)
values
  (
    'basic',
    'Diagnostico RIT',
    149000,
    'COP',
    '["Score de cumplimiento", "Checklist priorizado", "Resumen ejecutivo"]'::jsonb,
    true
  ),
  (
    'pro',
    'RITCheck Pro',
    249000,
    'COP',
    '["Score de cumplimiento", "Cambios obligatorios", "Texto juridico sugerido", "Plan de accion"]'::jsonb,
    true
  ),
  (
    'premium',
    'Revision prioritaria',
    399000,
    'COP',
    '["Todo Pro", "Revision humana MVP", "Entrega prioritaria", "Checklist ampliado"]'::jsonb,
    true
  )
on conflict (id) do update
set name = excluded.name,
    amount_cop = excluded.amount_cop,
    features = excluded.features,
    active = excluded.active,
    updated_at = now();

-- TODO: agregar usuario admin/reviewer mediante Supabase Auth, no por seed SQL con credenciales.

