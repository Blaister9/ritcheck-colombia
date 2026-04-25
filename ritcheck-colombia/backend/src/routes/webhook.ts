// ==========================================
// ARCHIVO: backend/src/routes/webhook.ts
// PROPOSITO: Recibe webhooks de Bold y actualiza pagos/ordenes
// DEPENDENCIAS: express raw body, rateLimit, orderService
// LLAMADO DESDE: index.ts bajo /api/webhooks
// ==========================================

import { Router } from 'express';
import express from 'express';
import { webhookRateLimit } from '../middleware/rateLimit.js';
import { confirmBoldPaymentFromWebhook, verifyBoldWebhookSignature } from '../services/orderService.js';

export const webhookRouter = Router();

webhookRouter.post('/bold', webhookRateLimit, express.raw({ type: '*/*', limit: '512kb' }), async (req, res, next) => {
  try {
    const signature = req.headers['x-bold-signature'];
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);

    if (!verifyBoldWebhookSignature(rawBody, String(signature ?? ''))) {
      return res.status(401).json({ code: 'INVALID_SIGNATURE', message: 'Firma Bold invalida.' });
    }

    await confirmBoldPaymentFromWebhook(rawBody);
    return res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

// TODO: registrar idempotency key del evento Bold para evitar doble confirmacion de pagos.

