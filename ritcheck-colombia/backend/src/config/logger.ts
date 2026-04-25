// ==========================================
// ARCHIVO: backend/src/config/logger.ts
// PROPOSITO: Logger estructurado sin exponer contenido sensible de documentos
// DEPENDENCIAS: pino, env
// LLAMADO DESDE: API, servicios y workers
// ==========================================

import pino, { type LoggerOptions } from 'pino';
import { env, isProduction } from './env.js';

// Mantenemos una redaction-list explicita. Cualquier campo que pueda
// contener texto del RIT, prompt completo, claves o tokens debe figurar aqui.
const REDACTED_PATHS = [
  // HTTP
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-bold-signature"]',
  'res.headers["set-cookie"]',

  // Contenido sensible de documentos / IA / prompts
  '*.documentText',
  '*.ritText',
  '*.rawDocument',
  '*.parsedText',
  '*.text',
  '*.prompt',
  '*.systemPrompt',
  '*.userPrompt',
  '*.rawPrompt',
  '*.rawResponse',
  '*.message.content',

  // Datos de cliente que no aportan en logs
  '*.customerEmail',
  '*.customer.email',
  '*.customer.name',
  '*.companyNit',

  // Secrets (defensa en profundidad: nunca deberian ir al log)
  '*.SUPABASE_SERVICE_ROLE_KEY',
  '*.SUPABASE_ANON_KEY',
  '*.ANTHROPIC_API_KEY',
  '*.OPENAI_API_KEY',
  '*.BOLD_SECRET_KEY',
  '*.BOLD_WEBHOOK_SECRET',
  '*.RESEND_API_KEY',
  '*.WOMPI_PRIVATE_KEY',
  '*.WOMPI_EVENTS_SECRET',
  'env.SUPABASE_SERVICE_ROLE_KEY',
  'env.ANTHROPIC_API_KEY',
  'env.OPENAI_API_KEY',
  'env.BOLD_SECRET_KEY',
  'env.BOLD_WEBHOOK_SECRET',
  'env.RESEND_API_KEY',
];

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: {
    service: 'ritcheck-backend',
    env: env.APP_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACTED_PATHS,
    censor: '[REDACTED]',
    remove: false,
  },
  formatters: {
    // Pino emite `level: 30`; usamos string para herramientas de log centralizado.
    level: (label) => ({ level: label }),
  },
};

// En desarrollo intentamos pino-pretty si esta disponible. Si no, fallback silencioso.
function createDevTransport() {
  try {
    return pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
    });
  } catch {
    return undefined;
  }
}

const transport = !isProduction ? createDevTransport() : undefined;

export const logger = transport ? pino(baseOptions, transport) : pino(baseOptions);

// Helper para crear un child logger por request/job sin perder contexto.
export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

// Helper para errores: garantiza que solo llegan campos seguros.
export function logError(scope: string, error: unknown, extra: Record<string, unknown> = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error(
    {
      scope,
      err: { name: err.name, message: err.message, stack: err.stack },
      ...extra,
    },
    `[${scope}] ${err.message}`,
  );
}
