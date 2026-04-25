// ==========================================
// ARCHIVO: backend/src/middleware/validate.ts
// PROPOSITO: Middleware generico de validacion con Zod para body, params y
//   query. Pasa los errores Zod al errorHandler centralizado.
// DEPENDENCIAS: express, zod
// LLAMADO DESDE: Rutas REST
// ==========================================

import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Devuelve un middleware Express que valida y normaliza body/params/query
 * con los schemas Zod entregados. Si falla, lanza ZodError que el
 * errorHandler centraliza como `400 VALIDATION_ERROR`.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        // Express tipa req.params como ParamsDictionary; copiamos los valores
        // sin reasignar la referencia para no romper handlers downstream.
        Object.assign(req.params, parsedParams);
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);
        Object.assign(req.query, parsedQuery);
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(error);
      }
      return next(error);
    }
  };
}
