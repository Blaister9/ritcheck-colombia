// ==========================================
// ARCHIVO: backend/src/workers/cleanupWorker.ts
// PROPOSITO: Worker de retencion que elimina documentos sensibles cuya
//   ventana de retencion (DOCUMENT_RETENTION_DAYS) ya vencio.
// DEPENDENCIAS: BullMQ, storageService, env, logger
// LLAMADO DESDE: npm run worker:cleanup / Railway cron
// ==========================================

import { Queue, Worker } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redisConnection } from '../config/redis.js';
import { deleteExpiredDocuments } from '../services/storageService.js';

export const CLEANUP_JOB_ID = 'daily-document-cleanup';
export const CLEANUP_REPEAT_PATTERN = '0 3 * * *'; // 03:00 hora local APP_TIMEZONE

export const cleanupQueue = new Queue(env.CLEANUP_QUEUE_NAME, {
  connection: redisConnection,
  prefix: env.BULLMQ_PREFIX,
});

export const cleanupWorker = new Worker(
  env.CLEANUP_QUEUE_NAME,
  async (job) => {
    const beforeIso = new Date().toISOString();
    const startedAt = Date.now();

    logger.info(
      { scope: 'cleanupWorker', jobId: job.id, beforeIso },
      'Iniciando barrido de documentos vencidos',
    );

    let deletedCount = 0;
    try {
      deletedCount = await deleteExpiredDocuments(beforeIso);
    } catch (err) {
      logger.error(
        { scope: 'cleanupWorker', err: { message: (err as Error).message } },
        'Cleanup fallo',
      );
      throw err;
    }

    logger.info(
      {
        scope: 'cleanupWorker',
        deletedCount,
        durationMs: Date.now() - startedAt,
        beforeIso,
      },
      'Cleanup de documentos completado',
    );

    return { deletedCount, beforeIso };
  },
  {
    connection: redisConnection,
    prefix: env.BULLMQ_PREFIX,
    concurrency: 1,
  },
);

cleanupWorker.on('failed', (job, error) => {
  logger.error(
    {
      scope: 'cleanupWorker',
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      err: { name: error?.name, message: error?.message },
    },
    'Cleanup job fallo',
  );
});

/**
 * Programa el cleanup diario. Idempotente: si ya existe un job repeatable con
 * el mismo `jobId` no se duplica.
 */
export async function scheduleDailyCleanup(): Promise<void> {
  await cleanupQueue.add(
    'delete-expired-documents',
    {},
    {
      repeat: { pattern: CLEANUP_REPEAT_PATTERN, tz: env.APP_TIMEZONE },
      jobId: CLEANUP_JOB_ID,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );

  logger.info(
    { scope: 'cleanupWorker', pattern: CLEANUP_REPEAT_PATTERN, tz: env.APP_TIMEZONE },
    'Cleanup diario programado',
  );
}

// Ejecutar el scheduler al arrancar el proceso del worker. En tests, evitar
// invocar este efecto importando el archivo solo cuando NODE_ENV != 'test'.
if (process.env.NODE_ENV !== 'test' && process.env.SKIP_SCHEDULE !== '1') {
  scheduleDailyCleanup().catch((err) => {
    logger.error(
      { scope: 'cleanupWorker', err: { message: (err as Error).message } },
      'No fue posible programar cleanup diario',
    );
  });
}

// TODO: agregar alerta (PagerDuty/email) si deletedCount=0 por mas de 2 dias o
// si hay registros con status=failed acumulados en document_retention_jobs.
