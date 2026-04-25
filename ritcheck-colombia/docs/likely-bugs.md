<!--
==========================================
ARCHIVO: docs/likely-bugs.md
PROPOSITO: Lista de los 10 bugs mas probables y como prevenirlos
DEPENDENCIAS: Arquitectura backend/frontend/database
LLAMADO DESDE: QA, implementacion y pre-launch
==========================================
-->

# 10 Bugs Probables

1. Webhook Bold procesado dos veces.
   Prevencion: unique `(provider, provider_event_id)`, transaccion idempotente y eventos auditables.

2. Firma Bold validada contra body parseado, no raw body.
   Prevencion: `express.raw()` antes de `express.json()` y tests con fixtures firmados.

3. Orden marcada pagada con monto incorrecto.
   Prevencion: comparar monto, moneda COP, reference y orderId contra DB.

4. Upload permitido antes de pago.
   Prevencion: validar estado `paid` en transaccion antes de guardar documento.

5. Documento sensible queda en storage mas de 7 dias.
   Prevencion: `document_retention_jobs`, worker diario, alerta por vencidos no borrados.

6. Parser devuelve texto vacio para PDF escaneado.
   Prevencion: umbral minimo de palabras y estado `OCR_REQUIRED` o flujo OCR.

7. Modelo devuelve JSON invalido.
   Prevencion: response schema, validacion Zod, retry de reparacion y fallback manual.

8. OpenAI falla y bloquea entrega.
   Prevencion: Claude como fuente principal; OpenAI falla -> manual review, no job fallido automatico.

9. Link de reporte accesible por otro cliente.
   Prevencion: signed URL corta, auth/token firmado, RLS y no exponer paths.

10. PDF renderiza HTML sin escapar.
    Prevencion: escaping HTML, sanitizacion de texto de modelo y snapshots visuales.

## TODO

- TODO: convertir cada bug en prueba automatizada o fixture QA.
- TODO: agregar runbook de soporte para cada falla critica.

