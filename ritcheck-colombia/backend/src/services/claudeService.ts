// ==========================================
// ARCHIVO: backend/src/services/claudeService.ts
// PROPOSITO: Llama a Claude API para analisis juridico profundo del RIT
// DEPENDENCIAS: anthropic SDK, prompts, tipos de analisis, zod
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  CLAUDE_ANALYSIS_PROMPT_VERSION,
  CLAUDE_ANALYSIS_SYSTEM_PROMPT,
  buildClaudeAnalysisUserPrompt,
} from '../prompts/claudeAnalysis.js';
import type { ClaudeAnalysisResult, PlanId } from '../types/index.js';

const client = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  timeout: env.CLAUDE_TIMEOUT_MS,
});

const MAX_RIT_TEXT_CHARS = 25_000;
const CLAUDE_JSON_ONLY_INSTRUCTION =
  'Responde ÚNICAMENTE con JSON válido. Sin texto antes ni después. Sin markdown. Sin explicaciones.';

// ---- Schemas de validacion del JSON producido por Claude ----
const severitySchema = z.enum(['critical', 'high', 'medium', 'low']);

const findingSchema = z.object({
  id: z.string().min(1).max(120).optional().default(() => randomSlug('f')),
  title: z.string().min(1).max(300),
  severity: severitySchema,
  legalBasis: z.string().min(1).max(500),
  currentTextExcerpt: z.string().max(1500).optional().default(''),
  issue: z.string().min(1).max(2000),
  risk: z.string().min(1).max(2000),
  suggestedText: z.string().min(1).max(8000),
  confidence: z.coerce.number().min(0).max(1),
});

const checklistSchema = z.object({
  id: z.string().min(1).max(120).optional().default(() => randomSlug('c')),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(2000),
  severity: severitySchema,
  dueDate: z.string().optional(),
  ownerRole: z.string().optional(),
});

const actionPlanSchema = z.object({
  id: z.string().min(1).max(120).optional().default(() => randomSlug('a')),
  action: z.string().min(1).max(500),
  priority: z.coerce.number().int().min(1).max(5),
  dueDate: z.string().min(1),
  rationale: z.string().min(1).max(2000),
});

const claudeJsonSchema = z.object({
  score: z.coerce.number().int().min(0).max(100),
  executiveSummary: z.string().min(1).max(8000),
  findings: z.array(findingSchema).default([]),
  checklist: z.array(checklistSchema).default([]),
  actionPlan: z.array(actionPlanSchema).default([]),
});

export type ClaudeAnalysisError = Error & { code: string; retriable: boolean };

class ClaudeServiceError extends Error implements ClaudeAnalysisError {
  readonly code: string;
  readonly retriable: boolean;
  constructor(code: string, message: string, retriable = false, cause?: unknown) {
    super(message);
    this.name = 'ClaudeServiceError';
    this.code = code;
    this.retriable = retriable;
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export async function analyzeWithClaude(params: {
  ritText: string;
  planId?: PlanId;
  companyName?: string;
  companyNit?: string;
}): Promise<ClaudeAnalysisResult> {
  const { ritText } = params;
  if (!ritText || ritText.trim().length === 0) {
    throw new ClaudeServiceError('EMPTY_DOCUMENT', 'Texto del RIT vacio.', false);
  }

  const startedAt = Date.now();
  const truncatedRitText = ritText.slice(0, MAX_RIT_TEXT_CHARS);
  const userPrompt = buildClaudeAnalysisUserPrompt({ ...params, ritText: truncatedRitText });

  const message = await callClaudeWithRetry(async () =>
    client.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: env.CLAUDE_MAX_OUTPUT_TOKENS,
      system: `${CLAUDE_JSON_ONLY_INSTRUCTION}\n\n${CLAUDE_ANALYSIS_SYSTEM_PROMPT}`,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  );

  const latencyMs = Date.now() - startedAt;
  const rawText = extractTextFromMessage(message);
  console.log('=== RAW CLAUDE (primeros 3000 chars) ===');
  console.log(rawText.slice(0, 3000));
  console.log('=== FIN ===');
  const json = parseClaudeJson(rawText);
  const validated = validateClaudeJson(json);

  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;

  logger.info(
    {
      scope: 'claudeService',
      promptVersion: CLAUDE_ANALYSIS_PROMPT_VERSION,
      model: env.CLAUDE_MODEL,
      latencyMs,
      inputTokens,
      outputTokens,
      findings: validated.findings.length,
      score: validated.score,
    },
    'Claude analysis completado',
  );

  return {
    provider: 'claude',
    score: validated.score,
    executiveSummary: validated.executiveSummary,
    findings: validated.findings,
    checklist: validated.checklist,
    actionPlan: validated.actionPlan,
    rawResponseId: message.id,
    usage: {
      provider: 'claude',
      model: env.CLAUDE_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostUsd: computeClaudeCost(inputTokens, outputTokens),
    },
  };
}

// ---- Helpers ----

// Tipo estructural para evitar acoplarse al path interno del SDK; cubre
// `messages.create` no-streaming.
type AnthropicLikeMessage = {
  id: string;
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function extractTextFromMessage(message: AnthropicLikeMessage): string {
  const textBlocks = message.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text);
  if (textBlocks.length === 0) {
    throw new ClaudeServiceError('EMPTY_RESPONSE', 'Claude no devolvio texto en la respuesta.', false);
  }
  return textBlocks.join('\n').trim();
}

/**
 * Intenta parsear JSON tolerando casos comunes:
 * - bloque ```json ... ```
 * - texto antes/despues del objeto
 */
function repairTruncatedJson(text: string): string {
  let t = text;
  // Contar brackets sin cerrar
  const opens = (t.match(/\[/g) || []).length;
  const closes = (t.match(/\]/g) || []).length;
  const openBraces = (t.match(/\{/g) || []).length;
  const closeBraces = (t.match(/\}/g) || []).length;
  // Remover trailing coma si existe
  t = t.replace(/,\s*$/, '');
  // Cerrar arrays y objetos faltantes
  for (let i = 0; i < opens - closes; i++) t += ']';
  for (let i = 0; i < openBraces - closeBraces; i++) t += '}';
  return t;
}

export function parseClaudeJson(raw: string): unknown {
  const cleaned = stripJsonFences(raw);
  // 1) Intento directo
  try {
    return JSON.parse(cleaned);
  } catch {
    // 2) Buscar primer { y ultimo } / [ ]
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj !== -1 && lastObj > firstObj) {
      const candidate = cleaned.slice(firstObj, lastObj + 1);
      try {
        const repaired = repairTruncatedJson(candidate);        
        return JSON.parse(candidate);
      } catch (err) {
        throw new ClaudeServiceError(
          'INVALID_JSON',
          'La respuesta de Claude no contiene JSON valido tras intento de reparacion.',
          false,
          err,
        );
      }
    }
    throw new ClaudeServiceError('INVALID_JSON', 'La respuesta de Claude no es JSON valido.', false);
  }
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*\n?/i, '');
  t = t.replace(/\n?```\s*$/i, '');
  return t.trim();
}

function validateClaudeJson(json: unknown) {
  const result = claudeJsonSchema.safeParse(json);
  if (!result.success) {
    logger.warn(
      { scope: 'claudeService', issues: result.error.issues.slice(0, 5) },
      'Claude devolvio JSON con esquema invalido',
    );
    throw new ClaudeServiceError(
      'SCHEMA_MISMATCH',
      'La respuesta de Claude no cumple el esquema esperado.',
      false,
    );
  }
  return result.data;
}

/**
 * Tarifa orientativa (USD por 1M tokens). Actualizar segun el modelo
 * configurado en CLAUDE_MODEL y la fecha actual.
 */
function computeClaudeCost(inputTokens: number, outputTokens: number): number {
  const inputCostPerMillion = 3;
  const outputCostPerMillion = 15;
  const cost =
    (inputTokens / 1_000_000) * inputCostPerMillion +
    (outputTokens / 1_000_000) * outputCostPerMillion;
  return Number(cost.toFixed(6));
}

/**
 * Estimacion previa al call (para presupuesto/UI). Asume ~4 chars por token.
 */
export function estimateClaudeCost(ritText: string): number {
  const inputTokens = Math.ceil(ritText.length / 4);
  const outputTokens = 6_000;
  return computeClaudeCost(inputTokens, outputTokens);
}

async function callClaudeWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const classified = classifyAnthropicError(error);

      logger.warn(
        {
          scope: 'claudeService',
          attempt,
          attempts,
          code: classified.code,
          retriable: classified.retriable,
        },
        'Claude llamada fallo',
      );

      if (!classified.retriable || attempt === attempts) {
        throw classified;
      }
      await sleep(jitteredBackoff(attempt));
    }
  }

  throw lastError;
}

function classifyAnthropicError(error: unknown): ClaudeServiceError {
  if (error instanceof ClaudeServiceError) return error;

  if (error instanceof Anthropic.APIError) {
    if (error instanceof Anthropic.RateLimitError) {
      return new ClaudeServiceError('RATE_LIMITED', 'Claude rate limit', true, error);
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new ClaudeServiceError('TIMEOUT', 'Claude timeout', true, error);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new ClaudeServiceError('CONNECTION', 'Claude connection error', true, error);
    }
    if (error.status && error.status >= 500) {
      return new ClaudeServiceError(`HTTP_${error.status}`, 'Claude server error', true, error);
    }
    if (error.status === 400 || error.status === 422) {
      return new ClaudeServiceError(`HTTP_${error.status}`, 'Claude bad request', false, error);
    }
    return new ClaudeServiceError(
      `HTTP_${error.status ?? 'UNKNOWN'}`,
      'Claude API error',
      false,
      error,
    );
  }

  const err = error instanceof Error ? error : new Error(String(error));
  return new ClaudeServiceError('UNKNOWN', err.message, false, err);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function randomSlug(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}
