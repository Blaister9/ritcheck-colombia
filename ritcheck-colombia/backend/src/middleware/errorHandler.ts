// ==========================================
// ARCHIVO: backend/src/middleware/errorHandler.ts
// PROPOSITO: Manejo centralizado de errores. Mapea errores conocidos a codigos
//   estables (4xx/5xx) sin filtrar contenido sensible ni stack traces al cliente.
// DEPENDENCIAS: express, zod, logger, OrderServiceError, MulterError
// LLAMADO DESDE: index.ts despues de las rutas
// ==========================================

import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { DocumentParseError } from '../services/documentParser.js';
import { OrderServiceError } from '../services/orderService.js';
import { StorageServiceError } from '../services/storageService.js';
import type { ApiErrorPayload } from '../types/index.js';

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // El parametro `next` es necesario para que Express trate este middleware
  // como manejador de errores, aunque no lo usemos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;

  // 1. Validacion Zod -> 400.
  if (error instanceof ZodError) {
    return respond(res, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Datos invalidos.',
      details: error.flatten(),
      requestId,
    });
  }

  // 2. Errores de servicio (logica de negocio) -> usan su httpStatus propio.
  if (error instanceof OrderServiceError) {
    return respond(res, error.httpStatus, {
      code: error.code,
      message: error.message,
      requestId,
    });
  }

  // 3. Errores de parseo de documento -> 422 Unprocessable Entity.
  if (error instanceof DocumentParseError) {
    return respond(res, 422, {
      code: error.code,
      message: error.safeMessage,
      requestId,
    });
  }

  // 4. Errores de storage genericos -> 500 si no se mapeo a otra cosa.
  if (error instanceof StorageServiceError) {
    logger.error(
      { scope: 'errorHandler', code: error.code, requestId, path: req.path },
      'StorageServiceError',
    );
    return respond(res, 500, {
      code: error.code,
      message: 'Error procesando archivos.',
      requestId,
    });
  }

  // 5. Multer: archivos demasiado grandes o tipo invalido.
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return respond(res, 413, {
        code: 'FILE_TOO_LARGE',
        message: 'El archivo excede el tamano maximo permitido.',
        requestId,
      });
    }
    return respond(res, 400, {
      code: 'UPLOAD_ERROR',
      message: error.message || 'Error en la carga del archivo.',
      requestId,
    });
  }

  // 6. CORS y otros errores con flag conocido.
  if (error instanceof Error) {
    if (error.message.includes('CORS')) {
      return respond(res, 403, {
        code: 'CORS_FORBIDDEN',
        message: 'Origen no permitido.',
        requestId,
      });
    }
  }

  // 7. Fallback: 500 sin filtrar detalles.
  logger.error(
    {
      scope: 'errorHandler',
      requestId,
      path: req.path,
      err: errorToSafePayload(error),
    },
    'Unhandled API error',
  );

  return respond(res, 500, {
    code: 'INTERNAL_ERROR',
    message: 'Ocurrio un error inesperado.',
    requestId,
  });
}

function respond(res: Response, status: number, payload: ApiErrorPayload) {
  if (res.headersSent) return;
  res.status(status).json(payload);
}

function errorToSafePayload(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { value: typeof error };
}
