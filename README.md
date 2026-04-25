RITCheck Colombia
RITCheck es un SaaS para PYMEs colombianas que analiza Reglamentos Internos de Trabajo (RIT) frente a la Ley 2466 de 2025 y entrega un reporte PDF con score de cumplimiento, cambios obligatorios, texto juridico sugerido, checklist y plan de accion.

Nota juridica: este repositorio estructura el producto y sus flujos. Antes de vender el primer analisis, un abogado laboral colombiano debe validar prompts, reglas, textos sugeridos y disclaimers.

Arquitectura
Frontend: Next.js 14, Tailwind CSS, shadcn/ui
Backend: Node.js, Express, TypeScript
Base de datos: Supabase PostgreSQL con RLS
Storage: Supabase Storage con borrado automatico a 7 dias
Queue: BullMQ + Redis
IA: Claude API para analisis juridico profundo + OpenAI API para critica adversarial
PDF: Playwright renderizando HTML
Pagos: Bold Colombia, con Wompi como respaldo futuro
Email: Resend
Deploy: Vercel para frontend, Railway para backend y workers
Flujo MVP
Cliente entra a landing y escoge plan.
Frontend crea orden en backend.
Cliente paga con Bold.
Webhook confirma pago y habilita upload.
Cliente sube RIT en PDF o DOCX.
Backend parsea documento, crea job BullMQ y actualiza estado a processing.
Worker ejecuta Claude y OpenAI en paralelo.
Combiner genera resultado final con hallazgos priorizados.
PDF se renderiza, se sube a storage y se marca orden completed.
Resend envia email con link firmado al reporte.
Estados de orden
pending_payment: orden creada, pago no confirmado.
paid: pago confirmado, pendiente de documento.
uploaded: documento recibido y validado.
processing: analisis en curso.
manual_review: requiere revision humana antes de entregar.
completed: PDF generado y disponible.
failed: error recuperable o definitivo.
expired: orden o link vencido.
Instalacion local
# TODO: crear scripts bootstrap cuando existan los proyectos implementados
cp .env.example .env
docker compose up -d redis
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
Variables
Las variables requeridas estan documentadas en .env.example. Nunca usar credenciales reales en commits.

Seguridad minima antes de produccion
Confirmar firmas de webhook Bold.
Activar RLS y politicas de storage.
Usar URLs firmadas con expiracion corta.
No loggear contenido de documentos ni prompts completos con datos del cliente.
Ejecutar cleanup diario de documentos y reportes vencidos.
Configurar rate limits por endpoint.
Revisar docs/security.md antes de abrir ventas.
Documentacion
docs/architecture.md: componentes, responsabilidades y flujos.
docs/api-endpoints.md: especificacion REST completa.
docs/security.md: amenazas, mitigaciones y politicas.
docs/deployment.md: despliegue en Vercel/Railway/Supabase.
docs/prompt-engineering.md: prompts, combinacion y costos IA.
docs/likely-bugs.md: 10 bugs probables y prevenciones.
docs/launch-checklist.md: checklist antes de cobrar el primer cliente.
TODO principal
TODO: implementar integraciones reales de Bold, Resend, Supabase y proveedores IA.
TODO: agregar pruebas unitarias, integracion y e2e.
TODO: validar textos juridicos con abogado laboral colombiano.
TODO: crear pipeline CI/CD con lint, typecheck, test y migraciones.
