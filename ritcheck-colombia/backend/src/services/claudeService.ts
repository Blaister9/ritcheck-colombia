// ==========================================
// ARCHIVO: backend/src/services/claudeService.ts
// PROPOSITO: Llama a Claude API para analisis juridico profundo del RIT
// DEPENDENCIAS: anthropic SDK, prompts, tipos de analisis
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { CLAUDE_ANALYSIS_SYSTEM_PROMPT, buildClaudeAnalysisUserPrompt } from '../prompts/claudeAnalysis.js';
import type { ClaudeAnalysisResult } from '../types/index.js';

const client = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  timeout: env.CLAUDE_TIMEOUT_MS,
});

export async function analyzeWithClaude(ritText: string): Promise<ClaudeAnalysisResult> {
  // TODO: aplicar chunking si ritText supera ventana segura de contexto.
  // TODO: validar JSON con Zod antes de retornar.
  const message = await callClaudeWithRetry(async () =>
    client.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: env.CLAUDE_MAX_OUTPUT_TOKENS,
      system: CLAUDE_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildClaudeAnalysisUserPrompt(ritText) }],
    }),
  );

  void message;

  // TODO: parsear content[0].text como JSON estructurado.
  return {
    provider: 'claude',
    score: 0,
    executiveSummary: 'TODO: resumen generado por Claude.',
    findings: [],
    checklist: [],
    actionPlan: [],
    usage: {
      provider: 'claude',
      model: env.CLAUDE_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: await estimateClaudeCost(ritText),
    },
  };
}

export async function estimateClaudeCost(ritText: string): Promise<number> {
  const estimatedInputTokens = Math.ceil(ritText.length / 4);
  const estimatedOutputTokens = 6000;
  // TODO: actualizar tarifas segun modelo real configurado y fecha de despliegue.
  const inputCostPerMillion = 3;
  const outputCostPerMillion = 15;
  return (estimatedInputTokens / 1_000_000) * inputCostPerMillion + (estimatedOutputTokens / 1_000_000) * outputCostPerMillion;
}

async function callClaudeWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
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

// TODO: distinguir rate limit, timeout y errores de contenido para fallback controlado.

