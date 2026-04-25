// ==========================================
// ARCHIVO: backend/src/config/supabase.ts
// PROPOSITO: Crea clientes Supabase anon y service-role para API y workers
// DEPENDENCIAS: @supabase/supabase-js, env
// LLAMADO DESDE: Servicios de ordenes, storage y auth
// ==========================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Cliente anon: usar SOLO en endpoints que aceptan tokens de usuarios finales.
// Nunca confiar en este cliente para operaciones administrativas.
export const supabaseAnon: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: { 'x-ritcheck-client': 'backend-anon' },
  },
});

// Cliente service-role: solo backend/workers. NUNCA exponer al frontend.
// Salta RLS, por lo que toda ruta que lo use debe haber validado autorizacion.
export const supabaseAdmin: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: { 'x-ritcheck-client': 'backend-service-role' },
  },
});

// Crea un cliente con el JWT del usuario final, util para operaciones que deben
// respetar RLS (ej: leer su propia orden). El backend nunca debe pasar service-role
// a esta funcion.
export function supabaseAsUser(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-ritcheck-client': 'backend-as-user',
      },
    },
  });
}

export const ritDocumentsBucket = env.SUPABASE_STORAGE_BUCKET_RIT;
export const reportsBucket = env.SUPABASE_STORAGE_BUCKET_REPORTS;

// Helper para construir paths consistentes en storage. No exponer order_id crudo
// en mensajes/URLs publicas: este path solo viaja por backend o links firmados.
export function buildDocumentStoragePath(orderId: string, filename: string): string {
  // Suprimimos cualquier directorio en el filename del cliente.
  const safeName = filename.split(/[/\\]/).pop() ?? 'document';
  const sanitized = safeName.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${orderId}/${Date.now()}-${sanitized}`;
}

export function buildReportStoragePath(orderId: string, version: number): string {
  return `${orderId}/v${version}.pdf`;
}
