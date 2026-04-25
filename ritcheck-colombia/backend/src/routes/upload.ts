// ==========================================
// ARCHIVO: backend/src/routes/upload.ts
// PROPOSITO: Recibe documentos RIT, valida archivo y encola analisis
// DEPENDENCIAS: express, multer, zod, storageService, orderService
// LLAMADO DESDE: index.ts
// ==========================================

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env, uploadAllowedMimeTypes } from '../config/env.js';
import { uploadRateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { markOrderUploadedAndQueueAnalysis } from '../services/orderService.js';
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
      return callback(new Error('Tipo de archivo no permitido.'));
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
  upload.single('document'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ code: 'FILE_REQUIRED', message: 'Debes adjuntar un archivo PDF o DOCX.' });
      }

      const document = await storeUploadedDocument(req.params.orderId, req.file);
      await markOrderUploadedAndQueueAnalysis(req.params.orderId, document.id);

      return res.status(202).json({
        orderId: req.params.orderId,
        documentId: document.id,
        status: 'uploaded',
      });
    } catch (error) {
      next(error);
    }
  },
);

// TODO: validar que la orden este pagada antes de aceptar upload.
// TODO: hacer antivirus o content scanning si se incorpora proveedor externo.

