<!--
==========================================
ARCHIVO: docs/launch-checklist.md
PROPOSITO: Checklist de lanzamiento antes de cobrar el primer cliente
DEPENDENCIAS: Todo el sistema RITCheck
LLAMADO DESDE: Founder, equipo tecnico y legal
==========================================
-->

# Launch Checklist

## Legal

- Validacion de prompts y matriz normativa por abogado laboral colombiano.
- Disclaimer aprobado para landing, checkout, emails y PDF.
- Politica de privacidad y tratamiento de datos publicada.
- Terminos de servicio con alcance: herramienta de apoyo, no concepto juridico definitivo.

## Producto

- Planes y precios finales en COP cargados en DB.
- Flujo completo probado: landing -> pago -> upload -> procesamiento -> PDF.
- Revision humana MVP definida: responsable, SLA, panel o procedimiento interno.
- Mensajes de error claros para pagos, documentos escaneados y jobs fallidos.

## Pagos

- Bold en produccion con webhook firmado.
- Prueba PSE, tarjeta y pago rechazado.
- Conciliacion de monto, moneda, referencia y estado.
- Politica de reembolso definida.

## Seguridad

- RLS activado y probado con anon, cliente, admin y service role.
- CORS limitado a dominios reales.
- Rate limiting con Redis en produccion.
- Secrets solo en Vercel/Railway/Supabase, nunca en repo.
- Cleanup de documentos vencidos con alerta.

## Infra

- Vercel frontend con dominio final.
- Railway API y workers separados.
- Redis con persistencia y metricas.
- Supabase backups activados.
- Monitoreo de healthchecks y errores.

## IA y QA

- 10 RIT fixtures evaluados por abogado.
- Costos por modelo registrados en `ai_model_runs`.
- Fallbacks probados: Claude falla, OpenAI falla, JSON invalido, PDF falla.
- Prompt versionado y trazable en reportes internos.

## Soporte

- Email de soporte operativo.
- Plantillas de respuesta para error de pago, documento invalido y reporte en revision.
- Runbook para reintentar jobs y regenerar PDFs.
- Responsable de revisar ordenes `failed` y `manual_review`.

## TODO final

- TODO: hacer compra real de prueba por valor minimo antes de vender.
- TODO: ejecutar prueba end-to-end con una empresa piloto y consentimiento expreso.
- TODO: revisar metricas de costo y tiempo antes de escalar pauta comercial.

