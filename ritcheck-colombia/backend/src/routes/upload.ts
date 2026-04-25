// ==========================================
// ARCHIVO: backend/src/routes/upload.ts
// PROPOSITO: Recibe documentos RIT, valida orden pagada, guarda y encola analisis
// DEPENDENCIAS: express, multer, zod, storageService, orderService, auth
// LLAMADO DESDE: index.ts
// ==========================================

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env, uploadAllowedMimeTypes } from '../config/env.js';
import { logger } from '../config/logger.js';
import { requireOrderAccess } from '../middleware/auth.js';
import { uploadRateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  getOrderById,
  markOrderUploadedAndQueueAnalysis,
  OrderServiceError,
} from '../services/orderService.js';
import { storeUploadedDocument } from '../services/storageService.js';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter(_req, file, callback) {
    if (!uploadAllowedMimeTypes.includes(file.mimetype)) {
      return callback(new Error('Tipo de archivo no permitido. Solo PDF o DOCX.'));
    }
    return callback(null, true);
  },
});

const uploadParamsSchema = z.object({
  orderId: z.string().uuid(),
});

uploadRouter.post(
  '/:orderId',
  uploadRateLimit,
  validate({ params: uploadParamsSchema }),
  requireOrderAccess,
  upload.single('document'),
  async (req, res, next) => {
    const orderId = req.params.orderId as string;
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ code: 'FILE_REQUIRED', message: 'Debes adjuntar un archivo PDF o DOCX.' });
      }

      // Validar que la orden este `paid` antes de aceptar archivos.
      const order = await getOrderById(orderId);
      if (!['paid', 'uploaded'].includes(order.status)) {
        throw new OrderServiceError(
          'INVALID_STATE',
          `La orden no acepta uploads en estado "${order.status}".`,
          409,
        );
      }

      const document = await storeUploadedDocument(orderId, req.file);
      await markOrderUploadedAndQueueAnalysis(orderId, document.id);

      logger.info(
        {
          scope: 'routes/upload',
          orderId,
          documentId: document.id,
          sizeBytes: document.sizeBytes,
          mimeType: document.mimeType,
        },
        'Documento recibido y job encolado',
      );

      return res.status(202).json({
        orderId,
        documentId: document.id,
        status: 'uploaded',
      });
    } catch (error) {
      return next(error);
    }
  },
);

// TODO: integrar antivirus (ClamAV o equivalente) antes de marcar uploaded.
// TODO: agregar deteccion de duplicados via SHA-256 cuando un cliente reintenta.
