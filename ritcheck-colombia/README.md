<!--
==========================================
ARCHIVO: README.md
PROPOSITO: Guia principal del repositorio RITCheck Colombia
DEPENDENCIAS: Node.js 20+, Supabase, Redis, Bold, Resend, Claude API, OpenAI API
LLAMADO DESDE: Desarrolladores, operadores y despliegue CI/CD
==========================================
-->

# RITCheck Colombia

RITCheck es un SaaS para PYMEs colombianas que analiza Reglamentos Internos de Trabajo (RIT) frente a la Ley 2466 de 2025 y entrega un reporte PDF con score de cumplimiento, cambios obligatorios, texto juridico sugerido, checklist y plan de accion.

> Nota juridica: este repositorio estructura el producto y sus flujos. Antes de vender el primer analisis, un abogado laboral colombiano debe validar prompts, reglas, textos sugeridos y disclaimers.

## Arquitectura

- Frontend: Next.js 14, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, TypeScript
- Base de datos: Supabase PostgreSQL con RLS
- Storage: Supabase Storage con borrado automatico a 7 dias
- Queue: BullMQ + Redis
- IA: Claude API para analisis juridico profundo + OpenAI API para critica adversarial
- PDF: Playwright renderizando HTML
- Pagos: Bold Colombia, con Wompi como respaldo futuro
- Email: Resend
- Deploy: Vercel para frontend, Railway para backend y workers

## Flujo MVP

1. Cliente entra a landing y escoge plan.
2. Frontend crea orden en backend.
3. Cliente paga con Bold.
4. Webhook confirma pago y habilita upload.
5. Cliente sube RIT en PDF o DOCX.
6. Backend parsea documento, crea job BullMQ y actualiza estado a `processing`.
7. Worker ejecuta Claude y OpenAI en paralelo.
8. Combiner genera resultado final con hallazgos priorizados.
9. PDF se renderiza, se sube a storage y se marca orden `completed`.
10. Resend envia email con link firmado al reporte.

## Estados de orden

- `pending_payment`: orden creada, pago no confirmado.
- `paid`: pago confirmado, pendiente de documento.
- `uploaded`: documento recibido y validado.
- `processing`: analisis en curso.
- `manual_review`: requiere revision humana antes de entregar.
- `completed`: PDF generado y disponible.
- `failed`: error recuperable o definitivo.
- `expired`: orden o link vencido.

## Instalacion local

```bash
# TODO: crear scripts bootstrap cuando existan los proyectos implementados
cp .env.example .env
docker compose up -d redis
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Variables

Las variables requeridas estan documentadas en `.env.example`. Nunca usar credenciales reales en commits.

## Seguridad minima antes de produccion

- Confirmar firmas de webhook Bold.
- Activar RLS y politicas de storage.
- Usar URLs firmadas con expiracion corta.
- No loggear contenido de documentos ni prompts completos con datos del cliente.
- Ejecutar cleanup diario de documentos y reportes vencidos.
- Configurar rate limits por endpoint.
- Revisar `docs/security.md` antes de abrir ventas.

## Documentacion

- `docs/architecture.md`: componentes, responsabilidades y flujos.
- `docs/api-endpoints.md`: especificacion REST completa.
- `docs/security.md`: amenazas, mitigaciones y politicas.
- `docs/deployment.md`: despliegue en Vercel/Railway/Supabase.
- `docs/prompt-engineering.md`: prompts, combinacion y costos IA.
- `docs/likely-bugs.md`: 10 bugs probables y prevenciones.
- `docs/launch-checklist.md`: checklist antes de cobrar el primer cliente.

## TODO principal

- TODO: implementar integraciones reales de Bold, Resend, Supabase y proveedores IA.
- TODO: agregar pruebas unitarias, integracion y e2e.
- TODO: validar textos juridicos con abogado laboral colombiano.
- TODO: crear pipeline CI/CD con lint, typecheck, test y migraciones.
