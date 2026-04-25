// ==========================================
// ARCHIVO: backend/src/routes/health.ts
// PROPOSITO: Healthchecks de API, Redis y dependencias criticas
// DEPENDENCIAS: express, redis, supabase
// LLAMADO DESDE: index.ts y monitores externos (Railway, uptime)
// ==========================================

import { Router } from 'express';
import { pingRedis, redisConnection } from '../config/redis.js';
import { supabaseAdmin } from '../config/supabase.js';

export const healthRouter = Router();

/**
 * Liveness check liviano. No depende de Supabase para evitar marcar como
 * caido un proceso que solo perdio temporalmente la base.
 */
healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'ritcheck-backend',
    redis: redisConnection.status,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness check: ping real a Redis y Supabase. Devuelve 503 si alguna
 * dependencia critica esta caida (util para healthchecks de Railway).
 */
healthRouter.get('/ready', async (_req, res) => {
  const startedAt = Date.now();

  const [redisOk, supabaseOk] = await Promise.all([
    pingRedis().catch(() => false),
    pingSupabase().catch(() => false),
  ]);

  const ready = redisOk && supabaseOk;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'ritcheck-backend',
    redis: redisOk,
    supabase: supabaseOk,
    durationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});

async function pingSupabase(): Promise<boolean> {
  // Una consulta minima a `plans` (tabla pequena, idempotente, RLS-friendly).
  const { error } = await supabaseAdmin.from('plans').select('id').limit(1);
  return !error;
}
