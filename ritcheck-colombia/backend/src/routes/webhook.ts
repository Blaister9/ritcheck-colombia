// ==========================================
// ARCHIVO: backend/src/routes/webhook.ts
// PROPOSITO: Recibe webhooks de Bold, valida firma sobre raw body y procesa
//   confirmaciones de pago de forma idempotente.
// DEPENDENCIAS: express raw body, rateLimit, orderService
// LLAMADO DESDE: index.ts bajo /api/webhooks
// ==========================================

import { Router } from 'express';
import express from 'express';
import { logger } from '../config/logger.js';
import { webhookRateLimit } from '../middleware/rateLimit.js';
import {
  confirmBoldPaymentFromWebhook,
  verifyBoldWebhookSignature,
} from '../services/orderService.js';

export const webhookRouter = Router();

webhookRouter.post(
  '/bold',
  webhookRateLimit,
  // IMPORTANTE: el body se mantiene como Buffer crudo para que la firma HMAC
  // se calcule sobre los bytes exactos enviados por Bold (cualquier
  // re-serializacion JSON cambiaria la firma).
  express.raw({ type: '*/*', limit: '512kb' }),
  async (req, res, next) => {
    try {
      const signature = String(req.headers['x-bold-signature'] ?? '');
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? '');

      if (!verifyBoldWebhookSignature(rawBody, signature)) {
        logger.warn(
          { scope: 'routes/webhook', signaturePresent: Boolean(signature) },
          'Webhook Bold con firma invalida',
        );
        return res
          .status(401)
          .json({ code: 'INVALID_SIGNATURE', message: 'Firma Bold invalida.' });
      }

      const result = await confirmBoldPaymentFromWebhook(rawBody);

      logger.info(
        {
          scope: 'routes/webhook',
          duplicate: result.duplicate ?? false,
          orderId: result.orderId,
        },
        'Webhook Bold procesado',
      );

      return res.status(200).json({ received: true });
    } catch (error) {
      return next(error);
    }
  },
);

// TODO: agregar webhook de Wompi como fallback con misma forma idempotente.
