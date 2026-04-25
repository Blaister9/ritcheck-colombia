<!--
==========================================
ARCHIVO: docs/security.md
PROPOSITO: Arquitectura de seguridad, amenazas, mitigaciones y controles
DEPENDENCIAS: backend, Supabase, Bold, Resend, proveedores IA
LLAMADO DESDE: Revision de seguridad y launch checklist
==========================================
-->

# Seguridad

## Principios

- Minimizar datos sensibles persistidos.
- Nunca loggear contenido de RIT.
- El backend es la unica capa con service role Supabase.
- Documentos y reportes viven en buckets privados.
- Links de descarga son firmados y expiran.
- Borrado automatico de documentos originales a los 7 dias.

## Vectores y mitigaciones

| Vector | Riesgo | Mitigacion |
| --- | --- | --- |
| Upload de malware | Archivos maliciosos o payloads grandes | MIME allowlist, limite 15 MB, storage privado, antivirus futuro |
| PDF/DOCX parser exploit | Vulnerabilidad de libreria | Dependencias actualizadas, workers aislados, timeouts |
| Exfiltracion por logs | RIT contiene datos sensibles | Redaction logger, no guardar texto parseado completo |
| Webhook falso | Marcar orden pagada sin pago real | Firma Bold, raw body, validar monto/COP/idempotencia |
| Repeticion webhook | Doble pago o doble email | Unique provider_event_id, transacciones |
| Enumeracion UUID | Acceso a reportes de terceros | Auth/token firmado, RLS, signed URLs |
| CORS amplio | Robo de tokens desde origen no autorizado | Allowlist exacta por ambiente |
| Abuso de IA | Costos altos por uploads repetidos | Rate limit por endpoint, orden pagada obligatoria, cola con attempts |
| Prompt injection en RIT | Documento intenta manipular modelo | System prompts fuertes, no ejecutar instrucciones del documento |
| Hallucination juridica | Recomendaciones incorrectas | Critica OpenAI, confidence, revision humana MVP |
| SSRF en PDF | HTML con recursos externos | Template local sin URLs externas, Playwright bloqueando requests futuras |
| Secret leakage | Variables filtradas | .env ignorado, Vercel/Railway secrets, redaction |
| Privilege escalation RLS | Cliente lee tablas internas | RLS restrictivo, service role solo backend |
| Data retention failure | Documentos no se eliminan | cleanup worker diario, alertas, auditoria `deleted_at` |
| Email leak | Hallazgos sensibles en correo | Email solo con link firmado, sin contenido juridico detallado |

## Rate limiting

- Global: 120 req/min/IP.
- Crear orden: 10 req/10 min/IP.
- Upload: 5 req/hora/IP.
- Status/report: 30 req/min/IP.
- Webhook Bold: 300 req/min/IP, mas firma obligatoria.

## Validacion de inputs

- Zod en body/params/query.
- UUID en `orderId`.
- Plan derivado de enum.
- Precio derivado del backend, nunca del cliente.
- MIME y tamano validados en frontend y backend.
- NIT opcional con validacion basica MVP; validacion DIAN futura.

## Manejo de documentos

- No almacenar texto parseado completo salvo que haya aprobacion explicita y cifrado adicional.
- Guardar SHA-256, tamano, MIME, bucket/path y fechas.
- Borrar original a los 7 dias con `cleanupWorker`.
- Mantener reporte PDF segun politica comercial; recomendado 30 dias para MVP.
- Usar buckets privados y signed URLs.

## Variables sensibles

- `SUPABASE_SERVICE_ROLE_KEY`
- `BOLD_SECRET_KEY`
- `BOLD_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `WOMPI_PRIVATE_KEY`
- `WOMPI_EVENTS_SECRET`

## TODO antes de produccion

- TODO: confirmar algoritmo exacto de firma Bold contra documentacion oficial.
- TODO: habilitar Redis store para rate limit multi-instancia.
- TODO: agregar CSP estricta en frontend.
- TODO: agregar pruebas negativas de RLS.
- TODO: agregar alerta si cleanup no borra documentos vencidos.

