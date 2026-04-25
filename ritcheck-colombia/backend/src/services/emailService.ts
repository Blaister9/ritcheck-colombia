// ==========================================
// ARCHIVO: backend/src/services/emailService.ts
// PROPOSITO: Envia emails transaccionales de orden, procesamiento y reporte listo
// DEPENDENCIAS: Resend, templates/emails, env
// LLAMADO DESDE: orderService.ts y analysisWorker.ts
// ==========================================

import { Resend } from 'resend';
import { env } from '../config/env.js';
import type { Order } from '../types/index.js';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOrderConfirmedEmail(order: Order): Promise<void> {
  // TODO: cargar templates/emails/order-confirmed.html y reemplazar placeholders.
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: order.customer.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: 'Pago confirmado - RITCheck Colombia',
    html: '<p>TODO: email pago confirmado.</p>',
  });
}

export async function sendProcessingEmail(order: Order): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: order.customer.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: 'Estamos analizando tu RIT',
    html: '<p>TODO: email procesamiento.</p>',
  });
}

export async function sendReportReadyEmail(order: Order, signedReportUrl: string): Promise<void> {
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: order.customer.email,
    replyTo: env.EMAIL_REPLY_TO,
    subject: 'Tu reporte RITCheck esta listo',
    html: `<p>TODO: email reporte listo. Link: ${signedReportUrl}</p>`,
  });
}

// TODO: agregar tracking de email_events con provider_message_id y estado.
// TODO: evitar incluir hallazgos sensibles dentro del email; usar solo link firmado.

