<!--
==========================================
ARCHIVO: docs/prompt-engineering.md
PROPOSITO: Documenta pipeline IA, prompts, combinacion, fallback y costos
DEPENDENCIAS: backend/src/prompts, servicios IA
LLAMADO DESDE: Equipo tecnico, legal y QA
==========================================
-->

# Prompt Engineering y Costos

Fuente legal inicial: [Ley 2466 de 2025 en Funcion Publica](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676). El producto debe revisar periodicamente circulares, reglamentos y jurisprudencia aplicable.

## Pipeline IA

1. Parseo: PDF/DOCX a texto normalizado.
2. Prevalidacion: word count, deteccion de documento escaneado, idioma y estructura.
3. Claude: analisis juridico profundo con JSON estructurado.
4. OpenAI: critica adversarial del output de Claude contra el mismo RIT.
5. Combiner: deduplica, ajusta score, marca revision manual y ordena hallazgos.
6. PDF: genera reporte profesional con disclaimer.
7. Auditoria: registra tokens, costo estimado, latencia y prompt version.

## Fallbacks

- Claude falla: reintentar 3 veces con backoff; si falla, orden `failed` y soporte.
- OpenAI falla: continuar con Claude, marcar `requiresManualReview=true`.
- JSON invalido: reparar una vez con modelo barato o parser estricto; si persiste, revision manual.
- Documento sin texto: marcar `failed` con razon `OCR_REQUIRED`; OCR futuro.
- PDF falla: reintentar render; si falla, generar HTML descargable interno para soporte.

## Estimacion de costos por analisis

Supuestos por RIT promedio:

- 20.000 a 35.000 palabras.
- 30.000 a 55.000 tokens de entrada por modelo tras normalizacion/chunking.
- 6.000 tokens salida Claude.
- 3.000 tokens salida OpenAI.

Estimacion conservadora por orden:

| Componente | Costo estimado USD |
| --- | ---: |
| Claude analisis | 0.18 - 0.35 |
| OpenAI critica | 0.20 - 0.45 |
| Playwright PDF | 0.01 - 0.03 |
| Supabase storage/DB | 0.01 - 0.03 |
| Redis/Railway prorrateado | 0.02 - 0.08 |
| Resend email | 0.00 - 0.01 |
| Total estimado | 0.42 - 0.95 |

Con TRM referencial de 4.000 COP/USD, costo variable estimado: 1.680 - 3.800 COP por analisis, sin incluir revision humana, impuestos, pasarela ni soporte.

## Margen bruto aproximado

| Plan | Precio COP | Costo variable IA/infra COP | Margen antes de pasarela/soporte |
| --- | ---: | ---: | ---: |
| Basic | 149.000 | 1.680 - 3.800 | Alto |
| Pro | 249.000 | 1.680 - 3.800 | Alto |
| Premium | 399.000 | 1.680 - 3.800 | Alto, pero incluye revision humana |

## TODO legal/QA

- TODO: convertir Ley 2466, CST y circulares en matriz de criterios versionada.
- TODO: crear fixtures de RIT buenos, deficientes y ambiguos.
- TODO: medir precision con abogado laboral antes de automatizar entrega.
- TODO: agregar evaluaciones regresivas por prompt version.

