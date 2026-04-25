<!--
==========================================
ARCHIVO: docs/architecture.md
PROPOSITO: Documenta arquitectura completa, flujo de usuario, estados y responsabilidades
DEPENDENCIAS: README, backend, frontend, database
LLAMADO DESDE: Equipo tecnico y producto
==========================================
-->

# Arquitectura RITCheck Colombia

Fuente normativa base para la Ley 2466 de 2025: [Funcion Publica - Gestor Normativo](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=260676).

## Componentes

- Frontend Next.js: landing, seleccion de plan, pago, upload, seguimiento y resultado.
- Backend Express: API REST, webhooks, validacion, estados y orquestacion.
- Supabase PostgreSQL: ordenes, pagos, documentos, resultados, eventos y auditoria.
- Supabase Storage: buckets privados `rit-documents` y `reports`.
- BullMQ + Redis: cola de analisis y limpieza.
- Workers: procesamiento IA/PDF y borrado automatico.
- Claude API: analisis juridico profundo.
- OpenAI API: critica adversarial y control de calidad.
- Playwright: PDF desde HTML.
- Resend: emails transaccionales.
- Bold: pagos Colombia.

## Flujo de usuario

1. Landing `/`: el usuario revisa planes y selecciona `basic`, `pro` o `premium`.
2. Pago `/pago`: el backend crea una orden `pending_payment` y sesion Bold.
3. Webhook Bold: `POST /api/webhooks/bold` valida firma, monto, moneda e idempotencia; marca `paid`.
4. Upload `/upload`: usuario sube PDF/DOCX; backend valida MIME, tamano y orden pagada.
5. Queue: se crea job `analyze-rit`; orden pasa a `uploaded` y luego `processing`.
6. Worker: descarga documento, parsea texto, ejecuta Claude y OpenAI, combina resultados.
7. PDF: genera reporte, lo guarda en bucket privado y crea metadata.
8. MVP: si `ENABLE_MANUAL_REVIEW=true`, orden pasa a `manual_review` para Edwin.
9. Entrega: tras aprobacion o automatizacion, orden pasa a `completed` y se envia link firmado.
10. Retencion: cleanup borra documentos originales a los 7 dias.

## Estados

| Estado | Descripcion | Email |
| --- | --- | --- |
| `pending_payment` | Orden creada, falta confirmacion Bold | No |
| `paid` | Pago aprobado, puede subir RIT | `order-confirmed` |
| `uploaded` | Documento guardado y job encolado | `processing` |
| `processing` | Worker analizando | Opcional |
| `manual_review` | Requiere revision humana MVP | Interno |
| `completed` | PDF disponible | `report-ready` |
| `failed` | Error de pago, parsing, IA o PDF | Soporte |
| `expired` | Orden/link vencido | Opcional |

## Contratos de datos

- `orders` es la fuente de verdad del estado.
- `payments` guarda eventos financieros idempotentes.
- `documents` guarda solo metadata y storage path, nunca texto completo.
- `analysis_results` guarda JSON final estructurado.
- `ai_model_runs` guarda uso/costo por proveedor sin prompt completo sensible.
- `reports` guarda metadata del PDF y version.
- `order_events` permite auditoria del ciclo de vida.

## Escalabilidad

- MVP: revision humana antes de entrega.
- V2: aprobacion automatica con umbrales de confianza.
- V3: multi-tenant white-label para firmas contables.
- V4: motor normativo por pais LATAM con prompts y reglas versionadas.

## TODO

- TODO: crear paquete compartido `packages/contracts` para tipos frontend/backend.
- TODO: agregar observabilidad con metricas por job, proveedor IA y pago.
- TODO: implementar panel interno de revision manual.

