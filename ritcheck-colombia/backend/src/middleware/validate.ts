// ==========================================
// ARCHIVO: backend/src/middleware/validate.ts
// PROPOSITO: Middleware generico de validacion con Zod para body, params y query
// DEPENDENCIAS: express, zod
// LLAMADO DESDE: Rutas REST
// ==========================================

import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}

// TODO: normalizar errores Zod a formato ApiErrorPayload en errorHandler.

