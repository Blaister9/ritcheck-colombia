// ==========================================
// ARCHIVO: backend/src/config/supabase.ts
// PROPOSITO: Crea clientes Supabase anon y service-role para API y workers
// DEPENDENCIAS: @supabase/supabase-js, env
// LLAMADO DESDE: Servicios de ordenes, storage y auth
// ==========================================

import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
});

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

// TODO: tipar clientes con Database generada desde Supabase CLI.
// TODO: restringir uso de supabaseAdmin a servicios internos y workers, nunca a rutas con datos no validados.

