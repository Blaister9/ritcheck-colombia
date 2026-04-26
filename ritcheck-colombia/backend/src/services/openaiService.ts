// ==========================================
// ARCHIVO: backend/src/services/openaiService.ts
// PROPOSITO: Llama a OpenAI para critica adversarial del analisis juridico
// DEPENDENCIAS: openai SDK, prompts, tipos, zod
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  OPENAI_CRITIQUE_PROMPT_VERSION,
  OPENAI_CRITIQUE_SYSTEM_PROMPT,
  buildOpenAICritiqueUserPrompt,
} from '../prompts/openaiCritique.js';
import type { ClaudeAnalysisResult, OpenAICritiqueResult } from '../types/index.js';

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: env.OPENAI_TIMEOUT_MS,
});

const OPENAI_MAX_OUTPUT_TOKENS = 4_000;
const OPENAI_JSON_ONLY_INSTRUCTION =
  'Responde unicamente con JSON valido que cumpla el schema. Sin markdown, sin explicacion y sin texto adicional.';

// ---- Schemas ----
const severitySchema = z.enum(['critical', 'high', 'medium', 'low']);

const challengedFindingSchema = z.object({
  findingId: z.string().optional(),
  concern: z.string().min(1).max(2000),
  suggestedCorrection: z.string().min(1).max(4000),
  severityAdjustment: severitySchema.optional().nullable(),
});

const missingRiskSchema = z.object({
  id: z.string().optional().default(() => randomSlug('m')),
  title: z.string().min(1).max(300),
  severity: severitySchema,
  legalBasis: z.string().min(1).max(500),
  currentTextExcerpt: z.string().max(1500).optional().default(''),
  issue: z.string().min(1).max(2000),
  risk: z.string().min(1).max(2000),
  suggestedText: z.string().min(1).max(8000),
  confidence: z.coerce.number().min(0).max(1),
});

const openaiJsonSchema = z.object({
  challengedFindings: z.array(challengedFindingSchema).default([]),
  missingRisks: z.array(missingRiskSchema).default([]),
  scoreAdjustment: z.coerce.number().int().min(-50).max(50).default(0),
});

const openaiCritiqueResponseSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['challengedFindings', 'missingRisks', 'scoreAdjustment'],
  properties: {
    challengedFindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['findingId', 'concern', 'suggestedCorrection', 'severityAdjustment'],
        properties: {
          findingId: {
            type: 'string',
            description: 'ID del hallazgo criticado. Usar cadena vacia si no aplica.',
          },
          concern: { type: 'string' },
          suggestedCorrection: { type: 'string' },
          severityAdjustment: {
            type: ['string', 'null'],
            enum: ['critical', 'high', 'medium', 'low', null],
          },
        },
      },
    },
    missingRisks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'title',
          'severity',
          'legalBasis',
          'currentTextExcerpt',
          'issue',
          'risk',
          'suggestedText',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          legalBasis: { type: 'string' },
          currentTextExcerpt: { type: 'string' },
          issue: { type: 'string' },
          risk: { type: 'string' },
          suggestedText: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    scoreAdjustment: {
      type: 'integer',
      minimum: -20,
      maximum: 10,
    },
  },
};

class OpenAIServiceError extends Error {
  readonly code: string;
  readonly retriable: boolean;
  constructor(code: string, message: string, retriable = false, cause?: unknown) {
    super(message);
    this.name = 'OpenAIServiceError';
    this.code = code;
    this.retriable = retriable;
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

export async function critiqueWithOpenAI(
  ritText: string,
  claudeResult: ClaudeAnalysisResult,
): Promise<OpenAICritiqueResult> {
  if (!ritText || ritText.trim().length === 0) {
    throw new OpenAIServiceError('EMPTY_DOCUMENT', 'Texto del RIT vacio.', false);
  }

  const startedAt = Date.now();
  const userPrompt = buildOpenAICritiqueUserPrompt({ ritText, claudeResult });

  const response = await callOpenAIWithRetry(async () =>
    client.responses.create({
      model: env.OPENAI_MODEL,
      instructions: `${OPENAI_JSON_ONLY_INSTRUCTION}\n\n${OPENAI_CRITIQUE_SYSTEM_PROMPT}`,
      input: userPrompt,
      max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      store: false,
      temperature: 0.2,
      reasoning: { effort: 'low' },
      text: {
        format: {
          type: 'json_schema',
          name: 'openai_critique_result',
          description: 'Critica adversarial estructurada del analisis juridico del RIT.',
          schema: openaiCritiqueResponseSchema,
          strict: true,
        },
      },
    }),
  );

  const latencyMs = Date.now() - startedAt;
  const rawText = extractResponseText(response);
  if (!rawText) {
    throw new OpenAIServiceError('EMPTY_RESPONSE', 'OpenAI no devolvio contenido.', false);
  }

  const json = parseOpenAIJson(rawText);
  const validated = validateOpenAIJson(json);

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  // Clamp de scoreAdjustment a [-20, 10] segun reglas del combiner.
  const clampedAdjustment = Math.max(-20, Math.min(10, validated.scoreAdjustment));

  logger.info(
    {
      scope: 'openaiService',
      promptVersion: OPENAI_CRITIQUE_PROMPT_VERSION,
      model: env.OPENAI_MODEL,
      latencyMs,
      inputTokens,
      outputTokens,
      challenged: validated.challengedFindings.length,
      missing: validated.missingRisks.length,
      scoreAdjustment: clampedAdjustment,
    },
    'OpenAI critique completado',
  );

  return {
    provider: 'openai',
    challengedFindings: validated.challengedFindings.map((c) => ({
      ...c,
      findingId: c.findingId?.trim() || undefined,
      severityAdjustment: c.severityAdjustment ?? undefined,
    })),
    missingRisks: validated.missingRisks,
    scoreAdjustment: clampedAdjustment,
    rawResponseId: response.id,
    usage: {
      provider: 'openai',
      model: env.OPENAI_MODEL,
      inputTokens,
      outputTokens,
      estimatedCostUsd: computeOpenAICost(inputTokens, outputTokens),
    },
  };
}

// ---- Helpers ----

export function parseOpenAIJson(raw: string): unknown {
  const cleaned = stripJsonFences(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    if (firstObj !== -1 && lastObj > firstObj) {
      try {
        return JSON.parse(cleaned.slice(firstObj, lastObj + 1));
      } catch (err) {
        throw new OpenAIServiceError(
          'INVALID_JSON',
          'OpenAI no devolvio JSON valido tras intento de reparacion.',
          false,
          err,
        );
      }
    }
    throw new OpenAIServiceError('INVALID_JSON', 'OpenAI no devolvio JSON valido.', false);
  }
}

type OpenAIResponsesLikeResponse = {
  id: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
};

function extractResponseText(response: OpenAIResponsesLikeResponse): string {
  if (response.status && response.status !== 'completed') {
    throw new OpenAIServiceError(
      'INCOMPLETE_RESPONSE',
      response.error?.message ?? response.incomplete_details?.reason ?? `OpenAI response status: ${response.status}`,
      false,
    );
  }

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => {
      if (content.type === 'refusal' && content.refusal) {
        throw new OpenAIServiceError('REFUSAL', content.refusal, false);
      }
      return content.type === 'output_text' ? content.text ?? '' : '';
    })
    .join('')
    .trim();

  return text ?? '';
}

function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/i, '');
    t = t.replace(/\n?```$/i, '');
  }
  return t.trim();
}

function validateOpenAIJson(json: unknown) {
  const result = openaiJsonSchema.safeParse(json);
  if (!result.success) {
    logger.warn(
      { scope: 'openaiService', issues: result.error.issues.slice(0, 5) },
      'OpenAI devolvio JSON con esquema invalido',
    );
    throw new OpenAIServiceError(
      'SCHEMA_MISMATCH',
      'OpenAI no cumple el esquema esperado.',
      false,
    );
  }
  return result.data;
}

function computeOpenAICost(inputTokens: number, outputTokens: number): number {
  // Tarifa orientativa en USD por 1M tokens. Actualizar segun OPENAI_MODEL real.
  const inputCostPerMillion = 5;
  const outputCostPerMillion = 15;
  const cost =
    (inputTokens / 1_000_000) * inputCostPerMillion +
    (outputTokens / 1_000_000) * outputCostPerMillion;
  return Number(cost.toFixed(6));
}

export function estimateOpenAICost(ritText: string, baseAnalysisJson = ''): number {
  const inputTokens = Math.ceil((ritText.length + baseAnalysisJson.length) / 4);
  const outputTokens = 3_000;
  return computeOpenAICost(inputTokens, outputTokens);
}

async function callOpenAIWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const classified = classifyOpenAIError(error);
      logger.warn(
        {
          scope: 'openaiService',
          attempt,
          attempts,
          code: classified.code,
          retriable: classified.retriable,
        },
        'OpenAI llamada fallo',
      );
      if (!classified.retriable || attempt === attempts) {
        throw classified;
      }
      await sleep(jitteredBackoff(attempt));
    }
  }

  throw lastError;
}

function classifyOpenAIError(error: unknown): OpenAIServiceError {
  if (error instanceof OpenAIServiceError) return error;
  if (error instanceof OpenAI.APIError) {
    if (error instanceof OpenAI.RateLimitError) {
      return new OpenAIServiceError('RATE_LIMITED', 'OpenAI rate limit', true, error);
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return new OpenAIServiceError('TIMEOUT', 'OpenAI timeout', true, error);
    }
    if (error instanceof OpenAI.APIConnectionError) {
      return new OpenAIServiceError('CONNECTION', 'OpenAI connection', true, error);
    }
    if (error.status && error.status >= 500) {
      return new OpenAIServiceError(`HTTP_${error.status}`, 'OpenAI server error', true, error);
    }
    if (error.status === 400 || error.status === 422) {
      return new OpenAIServiceError(`HTTP_${error.status}`, 'OpenAI bad request', false, error);
    }
    return new OpenAIServiceError(
      `HTTP_${error.status ?? 'UNKNOWN'}`,
      'OpenAI API error',
      false,
      error,
    );
  }
  const err = error instanceof Error ? error : new Error(String(error));
  return new OpenAIServiceError('UNKNOWN', err.message, false, err);
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
