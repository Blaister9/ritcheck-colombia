// ==========================================
// ARCHIVO: backend/src/services/orderService.ts
// PROPOSITO: Orquesta ciclo de vida de ordenes, pagos, estados y jobs de analisis
// DEPENDENCIAS: Supabase, BullMQ, Bold, tipos de dominio
// LLAMADO DESDE: routes/orders.ts, routes/upload.ts, routes/webhook.ts, workers
// ==========================================

import { Queue } from 'bullmq';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { redisConnection } from '../config/redis.js';
import { supabaseAdmin } from '../config/supabase.js';
import type { AnalysisJobData, Order, PlanId } from '../types/index.js';

const planPricesCop: Record<PlanId, number> = {
  basic: 149000,
  pro: 249000,
  premium: 399000,
};

export const analysisQueue = new Queue<AnalysisJobData>(env.ANALYSIS_QUEUE_NAME, {
  connection: redisConnection,
  prefix: env.BULLMQ_PREFIX,
});

interface CreateOrderInput {
  planId: PlanId;
  customerEmail: string;
  customerName?: string;
  companyName?: string;
  companyNit?: string;
}

export async function createOrder(input: CreateOrderInput) {
  const amountCop = planPricesCop[input.planId];

  // TODO: insertar orden en tabla orders con estado pending_payment.
  // TODO: crear sesion Bold desde backend y guardar payment_intent.
  return {
    orderId: crypto.randomUUID(),
    status: 'pending_payment',
    amountCop,
    checkoutUrl: 'TODO_BOLD_CHECKOUT_URL',
  };
}

export async function getOrderStatus(orderId: string) {
  // TODO: consultar orders por UUID y retornar estado publico.
  return {
    orderId,
    status: 'processing',
    updatedAt: new Date().toISOString(),
  };
}

export async function getOrderReport(orderId: string) {
  // TODO: verificar autorizacion por usuario autenticado o token firmado.
  // TODO: generar signed URL de reporte PDF desde Supabase Storage.
  return {
    orderId,
    status: 'completed',
    downloadUrl: 'TODO_SIGNED_REPORT_URL',
    expiresInSeconds: env.REPORT_SIGNED_URL_TTL_SECONDS,
  };
}

export async function markOrderUploadedAndQueueAnalysis(orderId: string, documentId: string) {
  // TODO: transaccion: validar orden pagada, actualizar a uploaded, insertar job en analysis_jobs.
  await analysisQueue.add(
    'analyze-rit',
    {
      orderId,
      documentId,
      planId: 'pro',
      customerEmail: 'TODO_CUSTOMER_EMAIL',
    },
    {
      jobId: orderId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

export function verifyBoldWebhookSignature(rawBody: Buffer, signature: string): boolean {
  // TODO: confirmar algoritmo exacto de Bold y usar timingSafeEqual.
  const expected = crypto.createHmac('sha256', env.BOLD_WEBHOOK_SECRET).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}

export async function confirmBoldPaymentFromWebhook(rawBody: Buffer) {
  const payload = JSON.parse(rawBody.toString('utf8'));
  // TODO: validar estructura del evento Bold, monto, moneda COP, merchant id y estado aprobado.
  // TODO: hacer upsert idempotente en payments y actualizar orders a paid.
  return payload;
}

export async function updateOrderStatus(orderId: string, status: Order['status'], metadata?: Record<string, unknown>) {
  // TODO: actualizar orders.status, updated_at y status_history en Supabase.
  await supabaseAdmin.from('order_events').insert({
    order_id: orderId,
    event_type: `status.${status}`,
    payload: metadata ?? {},
  });
}

// TODO: agregar createBoldCheckoutSession con monto derivado del plan guardado, no del cliente.
