// ==========================================
// ARCHIVO: backend/src/services/orderService.ts
// PROPOSITO: Orquesta ciclo de vida de ordenes, pagos Bold, estados,
//   integracion con Supabase y encolado de jobs de analisis.
// DEPENDENCIAS: Supabase Admin, BullMQ, Resend (via emailService), env
// LLAMADO DESDE: routes/orders.ts, routes/upload.ts, routes/webhook.ts, workers
// ==========================================

import { Queue } from 'bullmq';
import crypto from 'node:crypto';
import { env, isDemoMode } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redisConnection } from '../config/redis.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sendOrderConfirmedEmail } from './emailService.js';
import {
  createSignedReportUrl,
  getLatestReportForOrder,
} from './storageService.js';
import type {
  AnalysisJobData,
  CustomerInfo,
  Order,
  OrderStatus,
  PlanId,
} from '../types/index.js';

// ---- Tipos publicos del servicio ----

export interface CreateOrderInput {
  planId: PlanId;
  customerEmail: string;
  customerName?: string;
  companyName?: string;
  companyNit?: string;
}

export interface CreateOrderResult {
  orderId: string;
  status: OrderStatus;
  amountCop: number;
  checkoutUrl: string;
}

export interface OrderStatusResult {
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
  message?: string;
}

export interface OrderReportResult {
  orderId: string;
  status: OrderStatus;
  downloadUrl?: string;
  expiresInSeconds?: number;
  expiresAt?: string;
  message?: string;
}

export class OrderServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400, cause?: unknown) {
    super(message);
    this.name = 'OrderServiceError';
    this.code = code;
    this.httpStatus = httpStatus;
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

// ---- Plan pricing (fuente de verdad backend) ----
const planPricesCop: Record<PlanId, number> = {
  basic: 149_000,
  pro: 249_000,
  premium: 399_000,
};

const STATUS_MESSAGES: Partial<Record<OrderStatus, string>> = {
  pending_payment: 'Esperando confirmacion del pago.',
  paid: 'Pago confirmado. Sube tu RIT para iniciar el analisis.',
  uploaded: 'Documento recibido. Encolando analisis.',
  processing: 'Analisis en curso.',
  manual_review: 'En revision por el equipo legal antes de entregar.',
  completed: 'Reporte listo para descargar.',
  failed: 'Hubo un problema con tu orden. Soporte la esta revisando.',
  expired: 'La orden expiro. Crea una nueva si deseas continuar.',
};

// ---- BullMQ queue para analisis (singleton por proceso) ----
export const analysisQueue = new Queue<AnalysisJobData>(env.ANALYSIS_QUEUE_NAME, {
  connection: redisConnection,
  prefix: env.BULLMQ_PREFIX,
});

// ---- API publica ----

/**
 * Crea una orden en estado `pending_payment` y construye una URL de checkout
 * Bold. La URL se calcula desde backend con monto del plan; nunca se confia
 * en montos enviados por el cliente.
 *
 * Cuando DEMO_MODE=true en ambiente no-productivo, se omite Bold y se crea
 * la orden directamente en estado `paid` para permitir que el frontend
 * continue al upload sin pasar por el procesador de pagos.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const amountCop = planPricesCop[input.planId];
  if (!amountCop) {
    throw new OrderServiceError('INVALID_PLAN', 'Plan no valido.', 400);
  }

  // Asegurar que el plan existe en la tabla `plans` (semilla).
  await supabaseAdmin
    .from('plans')
    .upsert(
      {
        id: input.planId,
        name: planLabel(input.planId),
        amount_cop: amountCop,
        currency: env.BOLD_CURRENCY,
        active: true,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );

  const orderId = crypto.randomUUID();

  // ---- DEMO MODE ----
  // En ambientes no-productivos (NODE_ENV=development, APP_ENV in {local,staging})
  // con DEMO_MODE=true, omitimos la integracion con Bold y creamos la orden
  // directamente como `paid`. El frontend (pago page) detectara el estado paid
  // y redirigira automaticamente a /upload. No se generan webhooks ni rows en
  // payments: el flujo es estrictamente para demos / QA.
  if (isDemoMode) {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        id: orderId,
        plan_id: input.planId,
        status: 'paid',
        amount_cop: amountCop,
        currency: env.BOLD_CURRENCY,
        customer_email: input.customerEmail,
        customer_name: input.customerName ?? null,
        company_name_snapshot: input.companyName ?? null,
        company_nit_snapshot: input.companyNit ?? null,
        bold_checkout_id: null,
        checkout_url: null,
        paid_at: nowIso,
        metadata: { demo: true },
      })
      .select('id, status, amount_cop, created_at')
      .single();

    if (error || !data) {
      throw new OrderServiceError(
        'ORDER_CREATE_FAILED',
        'No fue posible crear la orden demo.',
        500,
        error,
      );
    }

    await insertOrderEvent(orderId, 'order.created', {
      planId: input.planId,
      amountCop,
      demo: true,
    });
    await insertOrderEvent(orderId, 'order.demo_paid', {
      planId: input.planId,
      amountCop,
      paidAt: nowIso,
    });

    logger.info(
      {
        scope: 'orderService',
        orderId,
        planId: input.planId,
        demoMode: true,
      },
      'Orden creada en DEMO_MODE: status paid sin pasar por Bold',
    );

    // checkoutUrl vacio: el frontend, al ver status=paid, redirige a /upload
    // sin necesidad de visitar el portal de pagos. Lo dejamos como string
    // vacio (no undefined) para mantener el contrato del tipo CreateOrderResult.
    return {
      orderId: data.id as string,
      status: data.status as OrderStatus,
      amountCop: data.amount_cop as number,
      checkoutUrl: '',
    };
  }

  // ---- FLUJO PRODUCTIVO (Bold) ----
  // Bold expone integraciones via API; aqui dejamos una URL placeholder que el
  // frontend usa para inicializar el widget. La integracion final con la API
  // de Bold (POST /v2/checkout/sessions o boton de pagos) se hace en
  // `createBoldCheckoutSession`.
  const { checkoutUrl, boldCheckoutId } = await createBoldCheckoutSession({
    orderId,
    amountCop,
    description: `RITCheck plan ${planLabel(input.planId)}`,
    customerEmail: input.customerEmail,
  });

  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert({
      id: orderId,
      plan_id: input.planId,
      status: 'pending_payment',
      amount_cop: amountCop,
      currency: env.BOLD_CURRENCY,
      customer_email: input.customerEmail,
      customer_name: input.customerName ?? null,
      company_name_snapshot: input.companyName ?? null,
      company_nit_snapshot: input.companyNit ?? null,
      bold_checkout_id: boldCheckoutId,
      checkout_url: checkoutUrl,
    })
    .select('id, status, amount_cop, created_at')
    .single();

  if (error || !data) {
    throw new OrderServiceError(
      'ORDER_CREATE_FAILED',
      'No fue posible crear la orden.',
      500,
      error,
    );
  }

  await insertOrderEvent(orderId, 'order.created', {
    planId: input.planId,
    amountCop,
    boldCheckoutId,
  });

  return {
    orderId: data.id as string,
    status: data.status as OrderStatus,
    amountCop: data.amount_cop as number,
    checkoutUrl,
  };
}

/**
 * Devuelve el estado publico de una orden. No incluye datos del cliente.
 */
export async function getOrderStatus(orderId: string): Promise<OrderStatusResult> {
  const order = await loadOrderRow(orderId);

  return {
    orderId: order.id,
    status: order.status,
    updatedAt: order.updated_at,
    message: STATUS_MESSAGES[order.status] ?? undefined,
  };
}

/**
 * Devuelve la URL firmada del reporte si la orden esta `completed`.
 * No expone storage paths brutos.
 */
export async function getOrderReport(orderId: string): Promise<OrderReportResult> {
  const order = await loadOrderRow(orderId);

  if (order.status !== 'completed') {
    return {
      orderId: order.id,
      status: order.status,
      message:
        order.status === 'manual_review'
          ? 'Reporte en revision humana.'
          : STATUS_MESSAGES[order.status] ?? 'Reporte aun no disponible.',
    };
  }

  const latest = await getLatestReportForOrder(orderId);
  if (!latest) {
    return {
      orderId: order.id,
      status: order.status,
      message: 'Reporte no encontrado en almacenamiento.',
    };
  }

  const { url, expiresAt } = await createSignedReportUrl(latest.storagePath);

  return {
    orderId: order.id,
    status: order.status,
    downloadUrl: url,
    expiresAt,
    expiresInSeconds: env.REPORT_SIGNED_URL_TTL_SECONDS,
  };
}

/**
 * Marca la orden como `uploaded`, registra el job en `analysis_jobs` y lo
 * encola en BullMQ. Se ejecuta despues de un upload exitoso.
 */
export async function markOrderUploadedAndQueueAnalysis(
  orderId: string,
  documentId: string,
): Promise<void> {
  const order = await loadOrderRow(orderId);

  // Solo permitimos transicion paid -> uploaded. Si ya esta uploaded/processing
  // por reintento, dejamos pasar idempotente.
  if (!['paid', 'uploaded'].includes(order.status)) {
    throw new OrderServiceError(
      'INVALID_STATE',
      `La orden no puede aceptar uploads en estado ${order.status}.`,
      409,
    );
  }

  await transitionOrderStatus(orderId, 'uploaded', { documentId });

  const { data: jobRow, error: jobError } = await supabaseAdmin
    .from('analysis_jobs')
    .insert({
      order_id: orderId,
      document_id: documentId,
      status: 'queued',
    })
    .select('id')
    .single();

  if (jobError || !jobRow) {
    throw new OrderServiceError(
      'JOB_CREATE_FAILED',
      'No fue posible crear el job de analisis.',
      500,
      jobError,
    );
  }

  await analysisQueue.add(
    'analyze-rit',
    {
      orderId,
      documentId,
      planId: order.plan_id as PlanId,
      customerEmail: order.customer_email,
    },
    {
      jobId: `${orderId.replace(/-/g, '')}-${jobRow.id.replace(/-/g, '')}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

/**
 * Verifica firma HMAC del webhook de Bold. La verificacion exacta depende del
 * algoritmo final que documente Bold; aqui implementamos HMAC-SHA256 sobre el
 * raw body con `BOLD_WEBHOOK_SECRET` como base inicial. El comparison es
 * timing-safe.
 *
 * Bold puede prefijar la firma con `sha256=`; soportamos ambos formatos.
 */
export function verifyBoldWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!signature) return false;
  const provided = signature.replace(/^sha256=/i, '').trim();
  const expected = crypto
    .createHmac('sha256', env.BOLD_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

interface BoldWebhookPayload {
  type?: string;
  id?: string;
  data?: {
    payment_id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: { order_id?: string };
    reference?: string;
  };
  // Algunos eventos viejos vienen aplanados:
  payment_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  metadata?: { order_id?: string };
  order_id?: string;
}

/**
 * Procesa un webhook de Bold ya firmado correctamente. Es idempotente por
 * `provider_event_id` (clave unica en `webhook_events`). Si el pago es
 * aprobado y la orden esta `pending_payment`, la transiciona a `paid` y
 * envia email de confirmacion.
 */
export async function confirmBoldPaymentFromWebhook(rawBody: Buffer): Promise<{
  received: true;
  duplicate?: boolean;
  orderId?: string;
}> {
  let payload: BoldWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as BoldWebhookPayload;
  } catch (err) {
    throw new OrderServiceError(
      'INVALID_PAYLOAD',
      'Webhook Bold con JSON invalido.',
      400,
      err,
    );
  }

  const eventId = payload.id ?? `${payload.type ?? 'unknown'}-${Date.now()}`;
  const eventType = payload.type ?? 'payment.unknown';
  const data = payload.data ?? {};
  const status = (data.status ?? payload.status ?? '').toLowerCase();
  const amount = data.amount ?? payload.amount;
  const currency = (data.currency ?? payload.currency ?? env.BOLD_CURRENCY).toUpperCase();
  const orderId = data.metadata?.order_id ?? payload.metadata?.order_id ?? payload.order_id;
  const providerPaymentId = data.payment_id ?? payload.payment_id ?? null;

  // 1. Insertar en webhook_events de forma idempotente.
  const { data: insertedEvent, error: eventError } = await supabaseAdmin
    .from('webhook_events')
    .upsert(
      {
        provider: 'bold',
        provider_event_id: eventId,
        event_type: eventType,
        signature_valid: true,
        payload: payload as unknown as Record<string, unknown>,
      },
      { onConflict: 'provider,provider_event_id', ignoreDuplicates: true },
    )
    .select('id, processed_at')
    .maybeSingle();

  if (eventError) {
    throw new OrderServiceError(
      'WEBHOOK_PERSIST_FAILED',
      'No fue posible registrar el evento del webhook.',
      500,
      eventError,
    );
  }

  // Si insertedEvent es null, el evento ya existia => idempotencia.
  if (!insertedEvent) {
    logger.info({ scope: 'orderService', eventId }, 'Webhook duplicado ignorado');
    return { received: true, duplicate: true };
  }

  // 2. Si no es un evento de pago aprobado, registramos y salimos.
  if (!isApprovedStatus(status) || !orderId) {
    await supabaseAdmin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', insertedEvent.id);
    return { received: true, orderId };
  }

  // 3. Validar la orden y el monto.
  const order = await loadOrderRow(orderId);
  if (typeof amount === 'number' && amount !== order.amount_cop) {
    logger.warn(
      { scope: 'orderService', orderId, expected: order.amount_cop, received: amount },
      'Webhook Bold con monto que no cuadra; ignorando confirmacion',
    );
    throw new OrderServiceError('AMOUNT_MISMATCH', 'Monto del webhook no coincide.', 400);
  }
  if (currency !== env.BOLD_CURRENCY) {
    throw new OrderServiceError('CURRENCY_MISMATCH', 'Moneda no esperada.', 400);
  }

  // 4. Upsert idempotente en payments.
  const { error: paymentError } = await supabaseAdmin
    .from('payments')
    .upsert(
      {
        order_id: orderId,
        provider: 'bold',
        provider_payment_id: providerPaymentId,
        provider_reference: data.reference ?? null,
        status: 'approved',
        amount_cop: order.amount_cop,
        currency: env.BOLD_CURRENCY,
        raw_event: payload as unknown as Record<string, unknown>,
        paid_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_payment_id' },
    );

  if (paymentError) {
    throw new OrderServiceError(
      'PAYMENT_PERSIST_FAILED',
      'No fue posible registrar el pago.',
      500,
      paymentError,
    );
  }

  // 5. Transicionar la orden si aun esta `pending_payment`.
  if (order.status === 'pending_payment') {
    await transitionOrderStatus(orderId, 'paid', {
      paid_at: new Date().toISOString(),
      providerPaymentId,
    });

    // Email de confirmacion. No bloquear si falla.
    try {
      await sendOrderConfirmedEmail(toDomainOrder({ ...order, status: 'paid' }));
    } catch (err) {
      logger.warn(
        { scope: 'orderService', orderId, err: { message: (err as Error).message } },
        'Fallo envio de email order-confirmed (continuamos)',
      );
    }
  }

  await supabaseAdmin
    .from('webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', insertedEvent.id);

  return { received: true, orderId };
}

/**
 * Cambia el estado de la orden y registra evento de auditoria.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await transitionOrderStatus(orderId, status, metadata);
}

/**
 * Carga la orden completa desde Supabase y la convierte al tipo de dominio.
 * Util para el worker.
 */
export async function getOrderById(orderId: string): Promise<Order> {
  const row = await loadOrderRow(orderId);
  return toDomainOrder(row);
}

// ---- Internals ----

interface OrderRow {
  id: string;
  plan_id: PlanId;
  status: OrderStatus;
  amount_cop: number;
  customer_email: string;
  customer_name: string | null;
  company_name_snapshot: string | null;
  company_nit_snapshot: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  completed_at: string | null;
}

async function loadOrderRow(orderId: string): Promise<OrderRow> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(
      'id, plan_id, status, amount_cop, customer_email, customer_name, company_name_snapshot, company_nit_snapshot, created_at, updated_at, paid_at, completed_at',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw new OrderServiceError(
      'ORDER_LOOKUP_FAILED',
      'No fue posible consultar la orden.',
      500,
      error,
    );
  }
  if (!data) {
    throw new OrderServiceError('ORDER_NOT_FOUND', 'Orden no encontrada.', 404);
  }
  return data as unknown as OrderRow;
}

async function transitionOrderStatus(
  orderId: string,
  status: OrderStatus,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'paid' && !updates.paid_at) updates.paid_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  if (status === 'failed' && metadata?.reason) {
    updates.failed_reason = String(metadata.reason).slice(0, 500);
  }

  const { error } = await supabaseAdmin.from('orders').update(updates).eq('id', orderId);

  if (error) {
    throw new OrderServiceError(
      'ORDER_UPDATE_FAILED',
      'No fue posible actualizar el estado de la orden.',
      500,
      error,
    );
  }

  await insertOrderEvent(orderId, `status.${status}`, metadata ?? {});
}

async function insertOrderEvent(
  orderId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from('order_events').insert({
    order_id: orderId,
    event_type: eventType,
    payload,
  });
  if (error) {
    logger.warn(
      { scope: 'orderService', orderId, eventType, err: { message: error.message } },
      'No fue posible registrar order_events',
    );
  }
}

function toDomainOrder(row: OrderRow): Order {
  const customer: CustomerInfo = {
    email: row.customer_email,
    name: row.customer_name ?? undefined,
    companyName: row.company_name_snapshot ?? undefined,
    companyNit: row.company_nit_snapshot ?? undefined,
  };
  return {
    id: row.id,
    planId: row.plan_id,
    status: row.status,
    amountCop: row.amount_cop,
    customer,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

function isApprovedStatus(status: string): boolean {
  return ['approved', 'paid', 'success', 'succeeded', 'completed', 'authorized'].includes(status);
}

function planLabel(planId: PlanId): string {
  switch (planId) {
    case 'basic':
      return 'Basic';
    case 'pro':
      return 'Pro';
    case 'premium':
      return 'Premium';
    default:
      return planId;
  }
}

/**
 * Crea (o simula) una sesion de checkout en Bold. La integracion final
 * dependera de la API exacta de Bold que se use (boton, links de pago, API
 * de checkout sessions). Para MVP devolvemos una URL hosted que incluye
 * orderId como reference y un identificador local; el webhook actualiza la
 * orden cuando el pago se aprueba.
 */
async function createBoldCheckoutSession(input: {
  orderId: string;
  amountCop: number;
  description: string;
  customerEmail: string;
}): Promise<{ checkoutUrl: string; boldCheckoutId: string }> {
  // TODO: reemplazar por llamada real a Bold API:
  //   POST {BOLD_API_BASE_URL}/v2/checkout/sessions
  //   Authorization: Bearer {BOLD_SECRET_KEY}
  //   body: { amount, currency, reference: orderId, redirection_url, ... }
  // Por ahora generamos un identificador determinista para trazabilidad y
  // construimos URL placeholder que el frontend usa con el widget Bold publico.
  const boldCheckoutId = `bold_${input.orderId.slice(0, 12)}_${Date.now()}`;
  const params = new URLSearchParams({
    apiKey: env.BOLD_PUBLIC_KEY,
    orderId: input.orderId,
    amount: String(input.amountCop),
    currency: env.BOLD_CURRENCY,
    description: input.description,
    redirectionUrl: `${env.FRONTEND_URL.replace(/\/$/, '')}/procesando?orderId=${input.orderId}`,
  });
  const checkoutUrl = `${env.BOLD_API_BASE_URL.replace(/\/$/, '')}/checkout?${params.toString()}`;

  return { checkoutUrl, boldCheckoutId };
}

// TODO: agregar metodo recreateBoldCheckoutSession cuando un cliente abandone
// y vuelva con la misma orden (regenerar checkout_url sin crear nueva orden).
