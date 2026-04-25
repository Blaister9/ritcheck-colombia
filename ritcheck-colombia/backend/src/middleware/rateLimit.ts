// ==========================================
// ARCHIVO: backend/src/middleware/rateLimit.ts
// PROPOSITO: Define rate limits por endpoint para reducir abuso y costos IA
// DEPENDENCIAS: express-rate-limit, env
// LLAMADO DESDE: index.ts y rutas REST
// ==========================================

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const globalRateLimit = rateLimit({
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: env.GLOBAL_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta nuevamente en un momento.' },
});

export const orderCreationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

export const statusRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: env.WEBHOOK_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

// TODO: mover almacenamiento de rate limits a Redis para multiples instancias en Railway.

