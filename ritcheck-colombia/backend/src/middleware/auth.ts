// ==========================================
// ARCHIVO: backend/src/middleware/auth.ts
// PROPOSITO: Autenticacion opcional/requerida usando JWT de Supabase Auth
// DEPENDENCIAS: express, supabaseAnon
// LLAMADO DESDE: Rutas que requieren usuario autenticado
// ==========================================

import type { NextFunction, Request, Response } from 'express';
import { supabaseAnon } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Autenticacion requerida.' });
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Token invalido o expirado.' });
  }

  req.user = {
    id: data.user.id,
    email: data.user.email,
  };

  return next();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  // TODO: implementar version opcional que agregue req.user si hay token valido, sin bloquear anonimos.
  return next();
}

