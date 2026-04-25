// ==========================================
// ARCHIVO: backend/src/prompts/combineOutputs.ts
// PROPOSITO: Reglas y helpers deterministicos para combinar Claude + OpenAI en un reporte final
// DEPENDENCIAS: Tipos de analisis
// LLAMADO DESDE: reportCombiner.ts
// ==========================================

import type { LegalFinding, Severity } from '../types/index.js';

export const COMBINE_OUTPUTS_VERSION = '2026-04-25.v1';

/**
 * Reglas declarativas que aplica `reportCombiner`. Se documentan aqui para
 * que QA/legal puedan auditarlas sin leer codigo.
 */
export const COMBINE_OUTPUTS_RULES = `
Reglas de combinacion (version ${COMBINE_OUTPUTS_VERSION}):
1. Claude es la fuente principal de diagnostico.
2. OpenAI actua como control adversarial; sus objeciones se incorporan cuando aumentan precision, reducen riesgo o detectan omisiones.
3. Si OpenAI propone severityAdjustment, se aplica solo si sube la severidad (jamas la baja sin revision humana).
4. Si OpenAI detecta missingRisks, se anaden al final del listado de findings (preservando id).
5. Si OpenAI propone scoreAdjustment, se aplica clamped a [-20, +10] y nunca puede subir el score por encima del de Claude si hay missingRisks.
6. Deduplica hallazgos por (titulo normalizado + base legal normalizada) o por (id, si comparten).
7. Ordena hallazgos por severidad (critical -> low) y dentro de la misma severidad por confianza descendente.
8. Marca requiresManualReview = true cuando: a) OpenAI agrego missingRisks; b) hay challengedFindings con severityAdjustment >= high; c) score < 60; d) ENABLE_MANUAL_REVIEW = true (configuracion global).
9. Todo texto sugerido se mantiene tal cual lo entrego el modelo, sin reescritura automatica.
10. Cualquier conflicto irresoluble se anota como nota interna en el hallazgo (campo internalNote, no expuesto al cliente).
`;

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Devuelve el rango ordinal (menor = mas grave). */
export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

/** Devuelve la severidad mas alta entre dos opciones. */
export function maxSeverity(a: Severity, b: Severity): Severity {
  return severityRank(a) <= severityRank(b) ? a : b;
}

/**
 * Llave de deduplicacion. Normaliza para que "Articulo 1 - Vacaciones" y
 * "ARTÍCULO 1   VACACIONES" colapsen.
 */
export function dedupKey(finding: Pick<LegalFinding, 'title' | 'legalBasis'>): string {
  return `${normalize(finding.title)}|${normalize(finding.legalBasis)}`;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    // Quita marcas diacriticas (tildes, dieresis, etc.)
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clamp del score a [0, 100]. */
export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Clamp del scoreAdjustment a [-20, 10] segun reglas. */
export function clampScoreAdjustment(adjustment: number): number {
  if (!Number.isFinite(adjustment)) return 0;
  return Math.max(-20, Math.min(10, Math.round(adjustment)));
}
