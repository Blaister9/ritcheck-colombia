// ==========================================
// ARCHIVO: backend/src/workers/analysisWorker.ts
// PROPOSITO: Worker BullMQ que orquesta el pipeline completo de analisis RIT:
//   parse -> Claude -> OpenAI (critica) -> combine -> PDF -> upload -> email.
//   Persiste analysis_results, ai_model_runs, analysis_jobs y order_events.
// DEPENDENCIAS: BullMQ, supabaseAdmin, servicios IA, parser, PDF, storage, email
// LLAMADO DESDE: npm run worker:analysis / Railway worker
// ==========================================

import { Worker, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redisConnection } from '../config/redis.js';
import { supabaseAdmin } from '../config/supabase.js';
import { analyzeWithClaude } from '../services/claudeService.js';
import { parseDocument, DocumentParseError } from '../services/documentParser.js';
import {
  sendProcessingEmail,
  sendReportReadyEmail,
} from '../services/emailService.js';
import { critiqueWithOpenAI } from '../services/openaiService.js';
import {
  getOrderById,
  updateOrderStatus,
} from '../services/orderService.js';
import { generateReportPdf } from '../services/pdfGenerator.js';
import { combineModelOutputs } from '../services/reportCombiner.js';
import {
  createSignedReportUrl,
  downloadDocumentBuffer,
  uploadReportPdf,
} from '../services/storageService.js';
import type {
  AnalysisJobData,
  ClaudeAnalysisResult,
  CombinedAnalysisResult,
  ModelUsage,
  OpenAICritiqueResult,
} from '../types/index.js';

interface DocumentRow {
  id: string;
  order_id: string;
  storage_path: string;
  storage_bucket: string;
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  sha256: string;
}

export const analysisWorker = new Worker<AnalysisJobData>(
  env.ANALYSIS_QUEUE_NAME,
  async (job) => runAnalysisJob(job),
  {
    connection: redisConnection,
    prefix: env.BULLMQ_PREFIX,
    concurrency: 2,
  },
);

analysisWorker.on('failed', async (job, error) => {
  const orderId = job?.data?.orderId;
  logger.error(
    {
      scope: 'analysisWorker',
      orderId,
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      err: { name: error?.name, message: error?.message },
    },
    'RIT analysis job fallo',
  );

  // Solo marcar la orden fallida cuando el job ya consumio todos los reintentos.
  if (orderId && job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await updateOrderStatus(orderId, 'failed', {
      reason: error?.message ?? 'unknown',
    }).catch(() => undefined);

    await markAnalysisJobStatus(orderId, 'failed', error?.message);
  }
});

analysisWorker.on('completed', (job, result) => {
  logger.info(
    {
      scope: 'analysisWorker',
      orderId: job.data.orderId,
      jobId: job.id,
      result,
    },
    'RIT analysis job completado',
  );
});

// ---- Pipeline ----

async function runAnalysisJob(job: Job<AnalysisJobData>): Promise<{
  orderId: string;
  reportPath: string;
  manualReview: boolean;
}> {
  const { orderId, documentId } = job.data;
  const log = logger.child({ scope: 'analysisWorker', orderId, documentId, jobId: job.id });

  log.info('Iniciando job de analisis RIT');

  // 0. Cargar contexto.
  const order = await getOrderById(orderId);
  const document = await loadDocumentRow(documentId);
  if (document.order_id !== orderId) {
    throw new Error('document_id no pertenece a la orden indicada.');
  }

  await updateOrderStatus(orderId, 'processing');
  await markAnalysisJobStatus(orderId, 'running');

  // Email de procesamiento (best-effort, no bloquea).
  void sendProcessingEmail(order).catch((err) =>
    log.warn({ err: { message: (err as Error).message } }, 'Fallo email processing'),
  );

  // 1. Descargar y parsear el documento.
  const buffer = await downloadDocumentBuffer(document.storage_path);
  let parsed;
  try {
    parsed = await parseDocument(orderId, buffer, document.mime_type);
  } catch (err) {
    if (err instanceof DocumentParseError) {
      // Errores de parseo no son retriables; falla la orden con mensaje seguro.
      await updateOrderStatus(orderId, 'failed', { reason: `${err.code}: ${err.safeMessage}` });
      await supabaseAdmin
        .from('documents')
        .update({ parse_status: 'failed' })
        .eq('id', documentId);
      throw new Error(`${err.code}: ${err.safeMessage}`);
    }
    throw err;
  }

  await supabaseAdmin
    .from('documents')
    .update({ parse_status: 'parsed', text_word_count: parsed.wordCount })
    .eq('id', documentId);

  // 2. Claude (analisis profundo).
  const claudeStart = Date.now();
  let claudeResult: ClaudeAnalysisResult;
  try {
    claudeResult = await analyzeWithClaude({
      ritText: parsed.text,
      planId: order.planId,
      companyName: order.customer.companyName,
      companyNit: order.customer.companyNit,
    });
  } catch (err) {
    await recordAiModelRun(orderId, 'claude', env.CLAUDE_MODEL, undefined, 'failed', {
      error: (err as Error).message,
      latencyMs: Date.now() - claudeStart,
    });
    throw err;
  }
  await recordAiModelRun(
    orderId,
    'claude',
    claudeResult.usage.model,
    claudeResult.usage,
    'completed',
    { latencyMs: Date.now() - claudeStart },
  );

  // 3. OpenAI (critica adversarial). Si falla, continuamos con manual_review.
  let openaiResult: OpenAICritiqueResult | undefined;
  const openaiStart = Date.now();
  try {
    openaiResult = await critiqueWithOpenAI(parsed.text, claudeResult);
    await recordAiModelRun(
      orderId,
      'openai',
      openaiResult.usage.model,
      openaiResult.usage,
      'completed',
      { latencyMs: Date.now() - openaiStart },
    );
  } catch (err) {
    log.warn(
      { err: { message: (err as Error).message } },
      'OpenAI critique fallo; continuamos con flag de revision manual',
    );
    await recordAiModelRun(orderId, 'openai', env.OPENAI_MODEL, undefined, 'failed', {
      error: (err as Error).message,
      latencyMs: Date.now() - openaiStart,
    });
  }

  // 4. Combinar resultados.
  const combined: CombinedAnalysisResult = combineModelOutputs(orderId, claudeResult, openaiResult);

  // 5. Persistir analysis_results (upsert por order_id unico).
  await persistAnalysisResults(combined);

  // 6. Generar PDF y subirlo.
  const pdfBuffer = await generateReportPdf(order, combined);
  const { storagePath, version, sha256 } = await uploadReportPdf(orderId, pdfBuffer);

  log.info({ storagePath, version, sha256, sizeBytes: pdfBuffer.length }, 'PDF subido');

  // 7. Decidir estado final.
  const finalStatus = combined.requiresManualReview ? 'manual_review' : 'completed';
  await updateOrderStatus(orderId, finalStatus, {
    reportPath: storagePath,
    reportVersion: version,
    requiresManualReview: combined.requiresManualReview,
    score: combined.score,
  });

  await markAnalysisJobStatus(orderId, 'completed');

  // 8. Si se entrega automaticamente, enviar email con link firmado.
  if (finalStatus === 'completed') {
    try {
      const { url, expiresAt } = await createSignedReportUrl(storagePath);
      await sendReportReadyEmail(order, url, expiresAt);
    } catch (err) {
      log.warn({ err: { message: (err as Error).message } }, 'Fallo email report-ready');
    }
  } else {
    // En MVP con ENABLE_MANUAL_REVIEW=true, notificar al reviewer.
    log.info(
      { reviewer: env.REVIEWER_EMAIL, score: combined.score },
      'Orden enviada a revision manual',
    );
    // TODO: agregar notificacion interna a Edwin via emailService o Slack.
  }

  return { orderId, reportPath: storagePath, manualReview: combined.requiresManualReview };
}

// ---- Helpers ----

async function loadDocumentRow(documentId: string): Promise<DocumentRow> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select(
      'id, order_id, storage_path, storage_bucket, mime_type, original_filename, size_bytes, sha256',
    )
    .eq('id', documentId)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`Documento ${documentId} no encontrado: ${error?.message ?? 'not_found'}`);
  }
  return data as unknown as DocumentRow;
}

async function persistAnalysisResults(combined: CombinedAnalysisResult): Promise<void> {
  const { error } = await supabaseAdmin.from('analysis_results').upsert(
    {
      order_id: combined.orderId,
      score: combined.score,
      executive_summary: combined.executiveSummary,
      findings: combined.findings,
      checklist: combined.checklist,
      action_plan: combined.actionPlan,
      model_usage: combined.modelUsage,
      requires_manual_review: combined.requiresManualReview,
    },
    { onConflict: 'order_id' },
  );

  if (error) {
    throw new Error(`No fue posible persistir analysis_results: ${error.message}`);
  }
}

async function recordAiModelRun(
  orderId: string,
  provider: 'claude' | 'openai',
  model: string,
  usage: ModelUsage | undefined,
  status: 'completed' | 'failed',
  extra: { latencyMs?: number; error?: string } = {},
): Promise<void> {
  const { error } = await supabaseAdmin.from('ai_model_runs').insert({
    order_id: orderId,
    provider,
    model,
    prompt_version:
      provider === 'claude' ? 'claude-analysis-v1' : 'openai-critique-v1',
    input_tokens: usage?.inputTokens ?? 0,
    output_tokens: usage?.outputTokens ?? 0,
    estimated_cost_usd: usage?.estimatedCostUsd ?? 0,
    latency_ms: extra.latencyMs ?? null,
    status,
    error_code: extra.error ? extra.error.slice(0, 120) : null,
  });

  if (error) {
    logger.warn(
      { scope: 'analysisWorker', provider, err: { message: error.message } },
      'No fue posible registrar ai_model_runs',
    );
  }
}

async function markAnalysisJobStatus(
  orderId: string,
  status: 'queued' | 'running' | 'completed' | 'failed',
  reason?: string,
): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'running') updates.started_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  if (status === 'failed' && reason) updates.failed_reason = reason.slice(0, 500);

  const { error } = await supabaseAdmin
    .from('analysis_jobs')
    .update(updates)
    .eq('order_id', orderId);

  if (error) {
    logger.warn(
      { scope: 'analysisWorker', orderId, err: { message: error.message } },
      'No fue posible actualizar analysis_jobs',
    );
  }
}

// TODO: agregar metricas (Prometheus/StatsD) por proveedor IA y duracion total.
// TODO: invocar este worker desde un proceso con graceful shutdown que cierre Redis y Browser.
