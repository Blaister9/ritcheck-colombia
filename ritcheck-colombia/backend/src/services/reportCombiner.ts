// ==========================================
// ARCHIVO: backend/src/services/reportCombiner.ts
// PROPOSITO: Combina resultado Claude y critica OpenAI en reporte final consistente
// DEPENDENCIAS: tipos de analisis, reglas de prompts
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  COMBINE_OUTPUTS_VERSION,
  clampScore,
  clampScoreAdjustment,
  dedupKey,
  maxSeverity,
  severityRank,
} from '../prompts/combineOutputs.js';
import type {
  ClaudeAnalysisResult,
  CombinedAnalysisResult,
  LegalFinding,
  OpenAICritiqueResult,
  Severity,
} from '../types/index.js';

const MANUAL_REVIEW_SCORE_THRESHOLD = 60;

/**
 * Combina deterministicamente la salida de Claude con la critica de OpenAI
 * en un unico `CombinedAnalysisResult`. La logica esta documentada en
 * `prompts/combineOutputs.ts` (`COMBINE_OUTPUTS_RULES`).
 *
 * Si `openaiResult` no se entrega (porque OpenAI fallo), se usa solo Claude
 * y se marca `requiresManualReview = true`.
 */
export function combineModelOutputs(
  orderId: string,
  claudeResult: ClaudeAnalysisResult,
  openaiResult?: OpenAICritiqueResult,
): CombinedAnalysisResult {
  const challenged = openaiResult?.challengedFindings ?? [];
  const missing = openaiResult?.missingRisks ?? [];

  // 1. Aplicar challengedFindings sobre los hallazgos primarios.
  const adjustedPrimary = applyChallengedFindings(claudeResult.findings, challenged);

  // 2. Mergear con missingRisks deduplicando.
  const merged = mergeFindings(adjustedPrimary, missing);

  // 3. Calcular score con clamp segun reglas (regla 5: si hay missingRisks, no
  //    puede subir por encima del score original de Claude).
  const rawAdjustment = clampScoreAdjustment(openaiResult?.scoreAdjustment ?? 0);
  let score = clampScore(claudeResult.score + rawAdjustment);
  if (missing.length > 0 && score > claudeResult.score) {
    score = claudeResult.score;
  }

  // 4. Banderas de revision manual.
  const requiresManualReview = computeRequiresManualReview({
    score,
    missingCount: missing.length,
    challenged,
    openaiAvailable: Boolean(openaiResult),
  });

  // 5. Sort final (severidad asc, confidence desc).
  const sortedFindings = sortFindings(merged);

  const combined: CombinedAnalysisResult = {
    orderId,
    score,
    executiveSummary: claudeResult.executiveSummary,
    findings: sortedFindings,
    checklist: claudeResult.checklist,
    actionPlan: claudeResult.actionPlan,
    modelUsage: openaiResult ? [claudeResult.usage, openaiResult.usage] : [claudeResult.usage],
    requiresManualReview,
  };

  logger.info(
    {
      scope: 'reportCombiner',
      orderId,
      combineVersion: COMBINE_OUTPUTS_VERSION,
      score,
      claudeScore: claudeResult.score,
      adjustment: rawAdjustment,
      findingsTotal: sortedFindings.length,
      missingFromOpenAI: missing.length,
      challenged: challenged.length,
      requiresManualReview,
      openaiAvailable: Boolean(openaiResult),
    },
    'Resultados combinados',
  );

  return combined;
}

// ---- Internals ----

function applyChallengedFindings(
  primary: LegalFinding[],
  challenged: OpenAICritiqueResult['challengedFindings'],
): LegalFinding[] {
  if (challenged.length === 0) return primary;

  // Index por id para lookup eficiente; los hallazgos sin id se deja sin tocar.
  const byId = new Map<string, LegalFinding>();
  for (const f of primary) {
    if (f.id) byId.set(f.id, { ...f });
  }

  for (const c of challenged) {
    if (!c.findingId) continue;
    const target = byId.get(c.findingId);
    if (!target) continue;

    // Regla 3: severityAdjustment solo se aplica si SUBE la severidad.
    if (c.severityAdjustment) {
      const proposed = c.severityAdjustment as Severity;
      const stricter = maxSeverity(target.severity, proposed);
      if (stricter !== target.severity) {
        target.severity = stricter;
      }
    }
  }

  // Reconstruir el array preservando orden original.
  return primary.map((f) => (f.id && byId.has(f.id) ? byId.get(f.id)! : f));
}

function mergeFindings(primary: LegalFinding[], additional: LegalFinding[]): LegalFinding[] {
  const seen = new Set<string>();
  const merged: LegalFinding[] = [];

  // Primero los primarios para preservar prioridad de Claude.
  for (const finding of primary) {
    const key = dedupKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(finding);
  }

  for (const finding of additional) {
    const key = dedupKey(finding);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(finding);
  }

  return merged;
}

function sortFindings(findings: LegalFinding[]): LegalFinding[] {
  return [...findings].sort((a, b) => {
    const sevDiff = severityRank(a.severity) - severityRank(b.severity);
    if (sevDiff !== 0) return sevDiff;
    return (b.confidence ?? 0) - (a.confidence ?? 0);
  });
}

function computeRequiresManualReview(params: {
  score: number;
  missingCount: number;
  challenged: OpenAICritiqueResult['challengedFindings'];
  openaiAvailable: boolean;
}): boolean {
  // Configuracion global obliga a revision manual mientras este encendido el flag.
  if (env.ENABLE_MANUAL_REVIEW) return true;

  // Sin OpenAI no podemos hacer control adversarial -> humano debe revisar.
  if (!params.openaiAvailable) return true;

  // Score bajo: enviarlo a revision para evitar entregar reportes negativos sin verificar.
  if (params.score < MANUAL_REVIEW_SCORE_THRESHOLD) return true;

  // Riesgos no detectados por Claude -> humano valida antes de entregar.
  if (params.missingCount > 0) return true;

  // Objeciones criticas/altas de OpenAI -> humano valida.
  const hasHighSeverityChallenge = params.challenged.some(
    (c) => c.severityAdjustment === 'critical' || c.severityAdjustment === 'high',
  );
  if (hasHighSeverityChallenge) return true;

  return false;
}
