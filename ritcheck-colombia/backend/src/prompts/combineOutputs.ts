// ==========================================
// ARCHIVO: backend/src/prompts/combineOutputs.ts
// PROPOSITO: Instrucciones para combinar analisis Claude y critica OpenAI en un reporte final
// DEPENDENCIAS: Tipos CombinedAnalysisResult
// LLAMADO DESDE: reportCombiner.ts
// ==========================================

export const COMBINE_OUTPUTS_RULES = `
Reglas de combinacion:
1. Claude es la fuente principal de diagnostico.
2. OpenAI actua como control adversarial; sus objeciones se incorporan cuando aumentan precision, reducen riesgo o detectan omisiones.
3. Si hay conflicto entre modelos, marca hallazgo como requiere revision manual.
4. Nunca subas el score por encima del de Claude si OpenAI detecta omisiones criticas.
5. Deduplica hallazgos por tema, base legal y accion sugerida.
6. Ordena hallazgos por severidad: critical, high, medium, low.
7. Todo texto sugerido debe ser claro, copiable y sujeto a revision profesional.
`;

// TODO: convertir estas reglas en funcion deterministica con pruebas unitarias.

