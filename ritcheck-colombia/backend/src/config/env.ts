// ==========================================
// ARCHIVO: backend/src/config/env.ts
// PROPOSITO: Valida y centraliza variables de entorno del backend
// DEPENDENCIAS: zod
// LLAMADO DESDE: index.ts, servicios y workers
// ==========================================

import { z } from 'zod';

// Bool helper: z.coerce.boolean() trata cualquier string no vacio como true ("false" -> true).
// Usamos un parser explicito que solo acepta valores reconocibles.
const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', ''].includes(normalized)) return false;
    throw new Error(`Valor booleano invalido: ${value}`);
  });

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  APP_TIMEZONE: z.string().default('America/Bogota'),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),
  PUBLIC_APP_NAME: z.string().default('RITCheck Colombia'),

  // Backend
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_AUDIENCE: z.string().default('authenticated'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  UPLOAD_ALLOWED_MIME_TYPES: z
    .string()
    .default('application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_RIT: z.string().default('rit-documents'),
  SUPABASE_STORAGE_BUCKET_REPORTS: z.string().default('reports'),

  // Redis / BullMQ
  REDIS_URL: z.string().min(1),
  BULLMQ_PREFIX: z.string().default('ritcheck'),
  ANALYSIS_QUEUE_NAME: z.string().default('rit-analysis'),
  CLEANUP_QUEUE_NAME: z.string().default('rit-cleanup'),

  // Bold Colombia
  BOLD_API_BASE_URL: z.string().url(),
  BOLD_PUBLIC_KEY: z.string().min(1),
  BOLD_SECRET_KEY: z.string().min(1),
  BOLD_WEBHOOK_SECRET: z.string().min(1),
  BOLD_CURRENCY: z.string().default('COP'),

  // Wompi (fallback futuro - opcional)
  WOMPI_PUBLIC_KEY: z.string().optional(),
  WOMPI_PRIVATE_KEY: z.string().optional(),
  WOMPI_EVENTS_SECRET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  EMAIL_REPLY_TO: z.string().email(),

  // Claude
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  CLAUDE_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(12000),
  CLAUDE_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5.5'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),

  // PDF
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  REPORT_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(604800),

  // Security / rate limit
  RATE_LIMIT_REDIS_URL: z.string().optional(),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  DOCUMENT_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Manual review MVP
  ENABLE_MANUAL_REVIEW: boolFromString.default(true),
  REVIEWER_EMAIL: z.string().email(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // No usar logger aqui: logger depende de env. Imprimir issues sin filtrar valores.
  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
  // eslint-disable-next-line no-console
  console.error('[env] Variables de entorno invalidas o faltantes:', JSON.stringify(issues, null, 2));
  throw new Error('Variables de entorno invalidas. Revisa .env contra .env.example.');
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production' || env.APP_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const uploadAllowedMimeTypes = env.UPLOAD_ALLOWED_MIME_TYPES.split(',')
  .map((mime) => mime.trim())
  .filter(Boolean);

// Dedicado a rate limit; cae al REDIS_URL principal si no se configura uno aparte.
export const rateLimitRedisUrl = env.RATE_LIMIT_REDIS_URL || env.REDIS_URL;

// Validaciones de coherencia por ambiente.
function assertProductionCoherence() {
  if (!isProduction) return;

  const requireHttps = (name: string, value: string) => {
    if (!value.startsWith('https://')) {
      throw new Error(`[env] ${name} debe usar HTTPS en produccion (recibido: ${new URL(value).protocol}).`);
    }
  };

  requireHttps('FRONTEND_URL', env.FRONTEND_URL);
  requireHttps('BACKEND_URL', env.BACKEND_URL);
  requireHttps('SUPABASE_URL', env.SUPABASE_URL);

  for (const origin of corsAllowedOrigins) {
    if (origin.includes('localhost') || origin.startsWith('http://')) {
      throw new Error(`[env] CORS_ALLOWED_ORIGINS no debe incluir orígenes locales/http en produccion: ${origin}`);
    }
  }

  if (env.ANTHROPIC_API_KEY.startsWith('TODO_') || env.OPENAI_API_KEY.startsWith('TODO_')) {
    throw new Error('[env] Claves IA placeholder TODO_ no permitidas en produccion.');
  }
  if (env.BOLD_SECRET_KEY.startsWith('TODO_') || env.BOLD_WEBHOOK_SECRET.startsWith('TODO_')) {
    throw new Error('[env] Claves Bold placeholder TODO_ no permitidas en produccion.');
  }
}

assertProductionCoherence();
