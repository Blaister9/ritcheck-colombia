// ==========================================
// ARCHIVO: backend/src/config/logger.ts
// PROPOSITO: Logger estructurado sin exponer contenido sensible de documentos
// DEPENDENCIAS: pino, env
// LLAMADO DESDE: API, servicios y workers
// ==========================================

import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.documentText',
      '*.ritText',
      '*.rawDocument',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      '*.ANTHROPIC_API_KEY',
      '*.OPENAI_API_KEY',
      '*.BOLD_SECRET_KEY',
    ],
    censor: '[REDACTED]',
  },
});

// TODO: enviar logs a proveedor centralizado con retencion limitada y alertas por errores de pagos/IA.

