// ==========================================
// ARCHIVO: backend/src/middleware/auth.ts
// PROPOSITO: Autenticacion por Supabase Auth (JWT) y autorizacion de ordenes
//   por token firmado HMAC para usuarios sin cuenta.
// DEPENDENCIAS: express, supabaseAnon, env
// LLAMADO DESDE: Rutas que requieren usuario autenticado o token de orden
// ==========================================

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { supabaseAnon } from '../config/supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  orderAuth?: {
    orderId: string;
    via: 'supabase' | 'order_token';
  };
}

const ORDER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

/**
 * Requiere un JWT valido de Supabase Auth.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Autenticacion requerida.' });
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Token invalido o expirado.' });
  }

  req.user = { id: data.user.id, email: data.user.email };
  return next();
}

/**
 * Si hay JWT valido, lo agrega a `req.user`; si no, deja pasar al request
 * como anonimo. No falla por token invalido (los flujos como crear orden
 * pueden ser anonimos en MVP).
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (!error && data.user) {
      req.user = { id: data.user.id, email: data.user.email };
    }
  } catch {
    // Ignoramos: optional.
  }
  return next();
}

/**
 * Autoriza acceso a una orden especifica:
 * - Si hay JWT valido y el email del JWT coincide con `orders.customer_email`,
 *   permitir.
 * - Si hay un `orderToken` (header `X-Order-Token` o query `?token=`) firmado
 *   correctamente para ese `orderId`, permitir.
 *
 * No carga la orden de DB aqui (lo hace el handler) para reducir round-trips:
 * marca `req.orderAuth` y deja que el servicio decida si existe.
 */
export async function requireOrderAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const orderId = req.params.orderId as string | undefined;
  if (!orderId) {
    return res.status(400).json({ code: 'MISSING_ORDER_ID', message: 'orderId requerido.' });
  }

  // 1. Token firmado de orden (sin sesion).
  const orderToken =
    (req.headers['x-order-token'] as string | undefined) ??
    (typeof req.query.token === 'string' ? req.query.token : undefined);

  if (orderToken && verifyOrderToken(orderId, orderToken)) {
    req.orderAuth = { orderId, via: 'order_token' };
    return next();
  }

  // 2. JWT Supabase. Validamos y dejamos que el handler verifique ownership
  //    por email contra la fila de la orden.
  const jwt = extractBearerToken(req);
  if (jwt) {
    const { data, error } = await supabaseAnon.auth.getUser(jwt);
    if (!error && data.user) {
      req.user = { id: data.user.id, email: data.user.email };
      req.orderAuth = { orderId, via: 'supabase' };
      return next();
    }
  }

  return res.status(401).json({
    code: 'ORDER_AUTH_REQUIRED',
    message: 'Necesitas un token de orden valido o iniciar sesion.',
  });
}

// ---- Order tokens (HMAC-SHA256 sobre orderId, con expiracion) ----

/**
 * Genera un token firmado del tipo `orderId.expiresAt.signature` que el
 * frontend usa para autorizar status/report sin login. La signature usa
 * `BOLD_WEBHOOK_SECRET` como base de HMAC (TODO: dedicar un secret aparte
 * para tokens si crece la superficie).
 */
export function signOrderToken(orderId: string, ttlSeconds = ORDER_TOKEN_TTL_SECONDS): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${orderId}.${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', tokenSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

export function verifyOrderToken(orderId: string, token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokenOrderId, expiresAtStr, signature] = parts;
  if (tokenOrderId !== orderId) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', tokenSecret())
    .update(`${tokenOrderId}.${expiresAtStr}`)
    .digest('hex');

  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function tokenSecret(): string {
  // TODO: introducir env.ORDER_TOKEN_SECRET dedicado y rotacion periodica.
  return env.BOLD_WEBHOOK_SECRET;
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}
