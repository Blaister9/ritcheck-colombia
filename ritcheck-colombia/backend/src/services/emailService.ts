// ==========================================
// ARCHIVO: backend/src/services/emailService.ts
// PROPOSITO: Envia emails transaccionales (order-confirmed, processing,
//   report-ready) usando Resend, con templates HTML locales y registro en
//   email_events para auditoria.
// DEPENDENCIAS: Resend, templates/emails/*.html, env, supabaseAdmin
// LLAMADO DESDE: orderService.ts y analysisWorker.ts
// ==========================================

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import type { Order } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const resend = new Resend(env.RESEND_API_KEY);

const TEMPLATE_BASE_CANDIDATES = [
  process.env.EMAIL_TEMPLATES_PATH,
  resolve(process.cwd(), 'templates/emails'),
  resolve(process.cwd(), '..', 'templates/emails'),
  resolve(__dirname, '../../../templates/emails'),
  resolve(__dirname, '../../../../templates/emails'),
].filter((p): p is string => Boolean(p));

const templateCache = new Map<string, string>();

type TemplateName = 'order-confirmed' | 'processing' | 'report-ready';

interface SendOptions {
  template: TemplateName;
  subject: string;
  to: string;
  orderId: string;
  variables: Record<string, string>;
}

export async function sendOrderConfirmedEmail(order: Order): Promise<void> {
  await sendTemplatedEmail({
    template: 'order-confirmed',
    subject: 'Pago confirmado - sube tu RIT',
    to: order.customer.email,
    orderId: order.id,
    variables: {
      CUSTOMER_NAME: friendlyName(order),
      ORDER_ID: order.id,
      ORDER_ID_SHORT: order.id.slice(0, 8),
      UPLOAD_URL: buildUploadUrl(order.id),
      SUPPORT_EMAIL: env.EMAIL_REPLY_TO,
    },
  });
}

export async function sendProcessingEmail(order: Order): Promise<void> {
  await sendTemplatedEmail({
    template: 'processing',
    subject: 'Estamos analizando tu RIT',
    to: order.customer.email,
    orderId: order.id,
    variables: {
      CUSTOMER_NAME: friendlyName(order),
      ORDER_ID: order.id,
      ORDER_ID_SHORT: order.id.slice(0, 8),
      STATUS_URL: buildStatusUrl(order.id),
      SUPPORT_EMAIL: env.EMAIL_REPLY_TO,
    },
  });
}

export async function sendReportReadyEmail(
  order: Order,
  signedReportUrl: string,
  expiresAt?: string,
): Promise<void> {
  await sendTemplatedEmail({
    template: 'report-ready',
    subject: 'Tu reporte RITCheck esta listo',
    to: order.customer.email,
    orderId: order.id,
    variables: {
      CUSTOMER_NAME: friendlyName(order),
      ORDER_ID: order.id,
      ORDER_ID_SHORT: order.id.slice(0, 8),
      REPORT_URL: signedReportUrl,
      REPORT_URL_EXPIRES_AT: expiresAt ? formatDate(expiresAt) : 'pronto',
      SUPPORT_EMAIL: env.EMAIL_REPLY_TO,
    },
  });
}

// ---- Internals ----

async function sendTemplatedEmail(options: SendOptions): Promise<void> {
  const html = await renderTemplate(options.template, options.variables);

  // Pre-registrar en email_events como queued para no perder el rastro si
  // Resend retorna error transitorio.
  const queuedRow = await insertEmailEvent({
    orderId: options.orderId,
    template: options.template,
    recipient: options.to,
    status: 'queued',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: options.to,
      replyTo: env.EMAIL_REPLY_TO,
      subject: options.subject,
      html,
      tags: [
        { name: 'order_id', value: options.orderId },
        { name: 'template', value: options.template },
      ],
    });

    if (error) {
      throw new Error(`Resend error: ${error.message ?? 'unknown'}`);
    }

    if (queuedRow?.id) {
      await supabaseAdmin
        .from('email_events')
        .update({ status: 'sent', provider_message_id: data?.id ?? null })
        .eq('id', queuedRow.id);
    }

    logger.info(
      {
        scope: 'emailService',
        template: options.template,
        orderId: options.orderId,
        providerMessageId: data?.id,
      },
      'Email transaccional enviado',
    );
  } catch (err) {
    const message = (err as Error).message ?? 'unknown';
    logger.error(
      {
        scope: 'emailService',
        template: options.template,
        orderId: options.orderId,
        err: { message },
      },
      'Fallo envio de email transaccional',
    );

    if (queuedRow?.id) {
      await supabaseAdmin
        .from('email_events')
        .update({ status: 'failed', error: message.slice(0, 500) })
        .eq('id', queuedRow.id);
    }

    // No relanzamos para no fallar todo el job por un email; el caller decide.
    // En caso de necesitar reintento, el registro queued en email_events queda
    // disponible para un job de reintento.
  }
}

async function renderTemplate(name: TemplateName, vars: Record<string, string>): Promise<string> {
  const cached = templateCache.get(name);
  let raw = cached ?? (await loadTemplateFromDisk(name));
  if (!cached) templateCache.set(name, raw);

  for (const [key, value] of Object.entries(vars)) {
    raw = raw.split(`{{${key}}}`).join(escapeHtml(value));
  }
  return raw;
}

async function loadTemplateFromDisk(name: TemplateName): Promise<string> {
  let lastError: unknown;
  for (const base of TEMPLATE_BASE_CANDIDATES) {
    try {
      const path = resolve(base, `${name}.html`);
      return await readFile(path, 'utf8');
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `No fue posible cargar el template de email "${name}". Error: ${
      (lastError as Error)?.message ?? 'desconocido'
    }`,
  );
}

async function insertEmailEvent(input: {
  orderId: string;
  template: string;
  recipient: string;
  status: 'queued' | 'sent' | 'failed';
}): Promise<{ id: string } | null> {
  const { data, error } = await supabaseAdmin
    .from('email_events')
    .insert({
      order_id: input.orderId,
      template: input.template,
      recipient: input.recipient,
      status: input.status,
    })
    .select('id')
    .single();

  if (error) {
    logger.warn(
      { scope: 'emailService', err: { message: error.message } },
      'No fue posible registrar email_events (continuamos)',
    );
    return null;
  }
  return { id: data.id as string };
}

function friendlyName(order: Order): string {
  const name = order.customer.name?.trim();
  if (name) return name.split(' ')[0];
  if (order.customer.companyName?.trim()) return order.customer.companyName.trim();
  return 'cliente';
}

function buildUploadUrl(orderId: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, '')}/upload?orderId=${encodeURIComponent(orderId)}`;
}

function buildStatusUrl(orderId: string): string {
  return `${env.FRONTEND_URL.replace(/\/$/, '')}/procesando?orderId=${encodeURIComponent(orderId)}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: env.APP_TIMEZONE || 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// TODO: agregar reintentos con backoff para fallos transitorios de Resend.
// TODO: agregar webhook de Resend para actualizar email_events a delivered/bounced.
