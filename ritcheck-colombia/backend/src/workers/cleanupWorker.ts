// ==========================================
// ARCHIVO: backend/src/workers/cleanupWorker.ts
// PROPOSITO: Worker de retencion que elimina documentos sensibles despues de 7 dias
// DEPENDENCIAS: BullMQ, storageService, env
// LLAMADO DESDE: npm run worker:cleanup / Railway cron
// ==========================================

import { Queue, Worker } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redisConnection } from '../config/redis.js';
import { deleteExpiredDocuments } from '../services/storageService.js';

export const cleanupQueue = new Queue(env.CLEANUP_QUEUE_NAME, {
  connection: redisConnection,
  prefix: env.BULLMQ_PREFIX,
});

export const cleanupWorker = new Worker(
  env.CLEANUP_QUEUE_NAME,
  async () => {
    const beforeIso = new Date().toISOString();
    const deletedCount = await deleteExpiredDocuments(beforeIso);
    logger.info({ deletedCount, beforeIso }, 'Expired documents cleanup completed');
    return { deletedCount };
  },
  {
    connection: redisConnection,
    prefix: env.BULLMQ_PREFIX,
    concurrency: 1,
  },
);

export async function scheduleDailyCleanup() {
  await cleanupQueue.add(
    'delete-expired-documents',
    {},
    {
      repeat: { pattern: '0 3 * * *', tz: env.APP_TIMEZONE },
      jobId: 'daily-document-cleanup',
    },
  );
}

// TODO: invocar scheduleDailyCleanup durante bootstrap del worker en Railway.
// TODO: agregar alerta si documentos vencidos no pueden borrarse.

