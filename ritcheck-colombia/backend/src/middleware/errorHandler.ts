// ==========================================
// ARCHIVO: backend/src/middleware/errorHandler.ts
// PROPOSITO: Manejo centralizado de errores sin filtrar secretos ni contenido de documentos
// DEPENDENCIAS: express, zod, logger
// LLAMADO DESDE: index.ts despues de rutas
// ==========================================

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Datos invalidos.',
      details: error.flatten(),
    });
  }

  logger.error({ error, path: req.path }, 'Unhandled API error');

  return res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'Ocurrio un error inesperado.',
  });
}

// TODO: mapear errores operacionales conocidos a 4xx/5xx especificos con codigos estables.

