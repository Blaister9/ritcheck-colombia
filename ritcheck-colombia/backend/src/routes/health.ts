// ==========================================
// ARCHIVO: backend/src/routes/health.ts
// PROPOSITO: Healthchecks de API, Redis y dependencias criticas
// DEPENDENCIAS: express, redis
// LLAMADO DESDE: index.ts y monitores externos
// ==========================================

import { Router } from 'express';
import { redisConnection } from '../config/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    const redisStatus = redisConnection.status;
    res.json({
      ok: true,
      service: 'ritcheck-backend',
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// TODO: agregar /ready con ping real a Supabase y Redis si el uptime monitor lo requiere.

