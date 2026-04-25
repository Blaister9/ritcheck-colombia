// ==========================================
// ARCHIVO: backend/src/services/reportCombiner.ts
// PROPOSITO: Combina resultado Claude y critica OpenAI en reporte final consistente
// DEPENDENCIAS: tipos de analisis, reglas de prompts
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import { COMBINE_OUTPUTS_RULES } from '../prompts/combineOutputs.js';
import type { ClaudeAnalysisResult, CombinedAnalysisResult, LegalFinding, OpenAICritiqueResult } from '../types/index.js';

export function combineModelOutputs(
  orderId: string,
  claudeResult: ClaudeAnalysisResult,
  openaiResult?: OpenAICritiqueResult,
): CombinedAnalysisResult {
  void COMBINE_OUTPUTS_RULES;

  const mergedFindings = mergeFindings(claudeResult.findings, openaiResult?.missingRisks ?? []);
  const adjustedScore = Math.max(0, Math.min(100, claudeResult.score + (openaiResult?.scoreAdjustment ?? 0)));

  return {
    orderId,
    score: adjustedScore,
    executiveSummary: claudeResult.executiveSummary,
    findings: mergedFindings,
    checklist: claudeResult.checklist,
    actionPlan: claudeResult.actionPlan,
    modelUsage: [claudeResult.usage, ...(openaiResult ? [openaiResult.usage] : [])],
    requiresManualReview: Boolean(openaiResult?.missingRisks.length || openaiResult?.challengedFindings.length),
  };
}

function mergeFindings(primary: LegalFinding[], additional: LegalFinding[]): LegalFinding[] {
  const seen = new Set<string>();
  const merged: LegalFinding[] = [];

  for (const finding of [...primary, ...additional]) {
    const key = `${finding.title.toLowerCase()}|${finding.legalBasis.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(finding);
  }

  return merged.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function severityRank(severity: LegalFinding['severity']) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[severity];
}

// TODO: aplicar challengedFindings para ajustar severidad, texto sugerido y notas de revision manual.
// TODO: agregar pruebas con conflictos modelo A/modelo B.

