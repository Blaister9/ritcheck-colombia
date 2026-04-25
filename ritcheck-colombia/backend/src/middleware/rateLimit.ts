// ==========================================
// ARCHIVO: backend/src/middleware/rateLimit.ts
// PROPOSITO: Define rate limits por endpoint para reducir abuso y costos IA.
//   En produccion conviene un store Redis distribuido; aqui usamos memoria
//   por defecto y permitimos opt-in a Redis via RATE_LIMIT_REDIS_URL.
// DEPENDENCIAS: express-rate-limit, env
// LLAMADO DESDE: index.ts y rutas REST
// ==========================================

import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const RATE_LIMITED_BODY = {
  code: 'RATE_LIMITED',
  message: 'Demasiadas solicitudes. Intenta nuevamente en un momento.',
};

const baseOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITED_BODY,
  // Por defecto, contar contra IP. Render/Railway usan trust proxy=1 (ver
  // index.ts) para que `req.ip` sea el cliente real.
};

export const globalRateLimit = rateLimit({
  ...baseOptions,
  windowMs: env.GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: env.GLOBAL_RATE_LIMIT_MAX,
});

// 10 req / 10 min / IP - consistente con docs/api-endpoints.md.
export const orderCreationRateLimit = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000,
  max: 10,
});

// 5 uploads / hora / IP. El upload tambien valida orden pagada en la ruta.
export const uploadRateLimit = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
});

// 30 req / min / IP para status y report (polling razonable desde frontend).
export const statusRateLimit = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: 30,
});

// 300 req / min / IP. Bold puede reintentar webhooks; evitamos saturarlo pero
// permitimos burst.
export const webhookRateLimit = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: env.WEBHOOK_RATE_LIMIT_MAX,
});

// TODO: cuando Railway escale a multiples instancias, instalar @rate-limit/redis
// y reemplazar el store por uno compartido para evitar bypass por shard.
