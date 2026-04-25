// ==========================================
// ARCHIVO: backend/src/config/env.ts
// PROPOSITO: Valida y centraliza variables de entorno del backend
// DEPENDENCIAS: zod
// LLAMADO DESDE: index.ts, servicios y workers
// ==========================================

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_TIMEZONE: z.string().default('America/Bogota'),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  UPLOAD_ALLOWED_MIME_TYPES: z.string().default('application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_RIT: z.string().default('rit-documents'),
  SUPABASE_STORAGE_BUCKET_REPORTS: z.string().default('reports'),
  REDIS_URL: z.string().url(),
  BULLMQ_PREFIX: z.string().default('ritcheck'),
  ANALYSIS_QUEUE_NAME: z.string().default('rit-analysis'),
  CLEANUP_QUEUE_NAME: z.string().default('rit-cleanup'),
  BOLD_API_BASE_URL: z.string().url(),
  BOLD_PUBLIC_KEY: z.string().min(1),
  BOLD_SECRET_KEY: z.string().min(1),
  BOLD_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  EMAIL_REPLY_TO: z.string().email(),
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().default('claude-3-5-sonnet-latest'),
  CLAUDE_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(12000),
  CLAUDE_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5.5'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(90000),
  PDF_RENDER_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  REPORT_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  DOCUMENT_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  ENABLE_MANUAL_REVIEW: z.coerce.boolean().default(true),
  REVIEWER_EMAIL: z.string().email(),
});

export const env = envSchema.parse(process.env);

export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
export const uploadAllowedMimeTypes = env.UPLOAD_ALLOWED_MIME_TYPES.split(',').map((mime) => mime.trim());

// TODO: agregar validacion de coherencia por ambiente, por ejemplo dominios HTTPS obligatorios en produccion.

