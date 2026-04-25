// ==========================================
// ARCHIVO: backend/src/config/redis.ts
// PROPOSITO: Configura conexion Redis compartida por BullMQ y rate limits
// DEPENDENCIAS: ioredis, env
// LLAMADO DESDE: workers, queues y middleware rateLimit
// ==========================================

import IORedis from 'ioredis';
import { env } from './env.js';

export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redisConnection = createRedisConnection();

// TODO: agregar configuracion TLS si Railway/Redis proveedor lo exige en produccion.

