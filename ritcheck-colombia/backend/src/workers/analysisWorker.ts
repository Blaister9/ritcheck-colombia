// ==========================================
// ARCHIVO: backend/src/workers/analysisWorker.ts
// PROPOSITO: Worker BullMQ que procesa documentos RIT y genera reportes
// DEPENDENCIAS: BullMQ, servicios IA, parser, PDF, storage, email
// LLAMADO DESDE: npm run worker:analysis / Railway worker
// ==========================================

import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redisConnection } from '../config/redis.js';
import { analyzeWithClaude } from '../services/claudeService.js';
import { parseDocument } from '../services/documentParser.js';
import { sendReportReadyEmail } from '../services/emailService.js';
import { critiqueWithOpenAI } from '../services/openaiService.js';
import { updateOrderStatus } from '../services/orderService.js';
import { generateReportPdf } from '../services/pdfGenerator.js';
import { combineModelOutputs } from '../services/reportCombiner.js';
import { downloadDocumentBuffer, uploadReportPdf } from '../services/storageService.js';
import type { AnalysisJobData, Order, UploadedDocument } from '../types/index.js';

export const analysisWorker = new Worker<AnalysisJobData>(
  env.ANALYSIS_QUEUE_NAME,
  async (job) => {
    const { orderId, documentId } = job.data;
    logger.info({ orderId, documentId, jobId: job.id }, 'Starting RIT analysis job');
    await updateOrderStatus(orderId, 'processing');

    // TODO: cargar metadata real de order y document desde Supabase.
    const order = buildPlaceholderOrder(orderId);
    const document = buildPlaceholderDocument(orderId, documentId);
    const buffer = await downloadDocumentBuffer(document.storagePath);
    const parsed = await parseDocument(orderId, buffer, document.mimeType);

    const claudeResult = await analyzeWithClaude(parsed.text);
    let openaiResult;

    try {
      openaiResult = await critiqueWithOpenAI(parsed.text, claudeResult);
    } catch (error) {
      logger.warn({ orderId, error }, 'OpenAI critique failed; continuing with manual review flag');
    }

    const combined = combineModelOutputs(orderId, claudeResult, openaiResult);
    const pdfBuffer = await generateReportPdf(order, combined);
    const reportPath = await uploadReportPdf(orderId, pdfBuffer);

    await updateOrderStatus(orderId, env.ENABLE_MANUAL_REVIEW || combined.requiresManualReview ? 'manual_review' : 'completed', {
      reportPath,
      requiresManualReview: combined.requiresManualReview,
    });

    // TODO: en MVP, enviar a reviewer antes de sendReportReadyEmail si ENABLE_MANUAL_REVIEW=true.
    await sendReportReadyEmail(order, 'TODO_SIGNED_REPORT_URL');

    return { orderId, reportPath };
  },
  {
    connection: redisConnection,
    prefix: env.BULLMQ_PREFIX,
    concurrency: 2,
  },
);

analysisWorker.on('failed', async (job, error) => {
  logger.error({ orderId: job?.data.orderId, jobId: job?.id, error }, 'RIT analysis job failed');
  if (job?.data.orderId) {
    await updateOrderStatus(job.data.orderId, 'failed', { reason: error.message });
  }
});

function buildPlaceholderOrder(orderId: string): Order {
  return {
    id: orderId,
    planId: 'pro',
    status: 'processing',
    amountCop: 249000,
    customer: { email: 'TODO@example.com' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function buildPlaceholderDocument(orderId: string, documentId: string): UploadedDocument {
  return {
    id: documentId,
    orderId,
    storagePath: `${orderId}/${documentId}.pdf`,
    originalFilename: 'TODO.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 0,
    sha256: 'TODO',
    uploadedAt: new Date().toISOString(),
    deleteAfter: new Date().toISOString(),
  };
}

// TODO: agregar worker events y metricas de duracion/costo por proveedor IA.

