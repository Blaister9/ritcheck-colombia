// ==========================================
// ARCHIVO: backend/src/services/openaiService.ts
// PROPOSITO: Llama a OpenAI para critica adversarial del analisis juridico
// DEPENDENCIAS: openai SDK, prompts, tipos
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import OpenAI from 'openai';
import { env } from '../config/env.js';
import { OPENAI_CRITIQUE_SYSTEM_PROMPT, buildOpenAICritiqueUserPrompt } from '../prompts/openaiCritique.js';
import type { ClaudeAnalysisResult, OpenAICritiqueResult } from '../types/index.js';

const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: env.OPENAI_TIMEOUT_MS,
});

export async function critiqueWithOpenAI(ritText: string, claudeResult: ClaudeAnalysisResult): Promise<OpenAICritiqueResult> {
  const baseAnalysisJson = JSON.stringify(claudeResult);

  // TODO: usar Responses API y response_format JSON schema cuando se implemente contra SDK actual.
  const response = await callOpenAIWithRetry(async () =>
    client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: OPENAI_CRITIQUE_SYSTEM_PROMPT },
        { role: 'user', content: buildOpenAICritiqueUserPrompt(ritText, baseAnalysisJson) },
      ],
      temperature: 0.2,
    }),
  );

  void response;

  // TODO: parsear JSON de response.choices[0].message.content y validar con Zod.
  return {
    provider: 'openai',
    challengedFindings: [],
    missingRisks: [],
    scoreAdjustment: 0,
    usage: {
      provider: 'openai',
      model: env.OPENAI_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: await estimateOpenAICost(ritText, baseAnalysisJson),
    },
  };
}

export async function estimateOpenAICost(ritText: string, baseAnalysisJson = ''): Promise<number> {
  const estimatedInputTokens = Math.ceil((ritText.length + baseAnalysisJson.length) / 4);
  const estimatedOutputTokens = 3000;
  // TODO: actualizar tarifas con el modelo OpenAI final usado en produccion.
  const inputCostPerMillion = 5;
  const outputCostPerMillion = 15;
  return (estimatedInputTokens / 1_000_000) * inputCostPerMillion + (estimatedOutputTokens / 1_000_000) * outputCostPerMillion;
}

async function callOpenAIWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await sleep(500 * 2 ** attempt);
    }
  }

  throw lastError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// TODO: implementar fallback cuando OpenAI falle: entregar Claude con bandera requiresManualReview.

