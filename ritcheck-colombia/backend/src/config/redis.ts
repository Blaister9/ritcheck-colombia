// ==========================================
// ARCHIVO: backend/src/config/redis.ts
// PROPOSITO: Configura conexion Redis compartida por BullMQ y rate limits
// DEPENDENCIAS: ioredis, env
// LLAMADO DESDE: workers, queues y middleware rateLimit
// ==========================================

import { Redis, type RedisOptions } from 'ioredis';
import { env, rateLimitRedisUrl } from './env.js';
import { logger } from './logger.js';

// BullMQ exige `maxRetriesPerRequest: null` y `enableReadyCheck: false` en las
// conexiones que usa para sus blocking commands. No reutilizar esta misma
// conexion para comandos no-blocking (publica/lee separadamente).
const bullMqOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
};

function attachLogging(client: Redis, label: string) {
  client.on('error', (err: Error) => {
    logger.error({ scope: 'redis', label, err: { name: err.name, message: err.message } }, 'Redis error');
  });
  client.on('reconnecting', (delay: number) => {
    logger.warn({ scope: 'redis', label, delayMs: delay }, 'Redis reconectando');
  });
  client.on('end', () => {
    logger.warn({ scope: 'redis', label }, 'Redis conexion cerrada');
  });
  return client;
}

/**
 * Conexion para BullMQ (queues, workers, schedulers).
 * Llamar una vez por proceso y reutilizar.
 */
export function createRedisConnection(label = 'bullmq') {
  return attachLogging(new Redis(env.REDIS_URL, bullMqOptions), label);
}

/**
 * Conexion para usos generales (cache, rate limit, lookups). NO usar con BullMQ.
 */
export function createGeneralRedisConnection(label = 'general') {
  return attachLogging(
    new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 3 }),
    label,
  );
}

/**
 * Conexion dedicada al store de rate-limit (puede apuntar a otra instancia
 * via RATE_LIMIT_REDIS_URL para aislar carga).
 */
export function createRateLimitRedisConnection() {
  return attachLogging(
    new Redis(rateLimitRedisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 }),
    'rate-limit',
  );
}

// Singleton para BullMQ. Los workers deberian importar este.
export const redisConnection = createRedisConnection('bullmq-default');

/**
 * Cierra todas las conexiones que se le pasen, ignorando errores. Usar en
 * graceful shutdown del proceso.
 */
export async function closeRedisConnections(connections: Redis[]): Promise<void> {
  await Promise.all(
    connections.map(async (conn) => {
      try {
        await conn.quit();
      } catch (err) {
        logger.warn(
          { scope: 'redis', err: { message: (err as Error).message } },
          'Error cerrando conexion Redis (ignorado)',
        );
      }
    }),
  );
}

/**
 * Ping rapido para healthchecks. Devuelve `true` si responde "PONG".
 */
export async function pingRedis(connection: Redis = redisConnection): Promise<boolean> {
  try {
    const reply = await connection.ping();
    return reply === 'PONG';
  } catch {
    return false;
  }
}
