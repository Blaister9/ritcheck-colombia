<!--
==========================================
ARCHIVO: docs/deployment.md
PROPOSITO: Guia de despliegue en Vercel, Railway, Supabase y proveedores externos
DEPENDENCIAS: .env.example, docker-compose.yml, database
LLAMADO DESDE: Operaciones y CI/CD
==========================================
-->

# Deployment

## Supabase

1. Crear proyecto Supabase en region cercana a Colombia.
2. Ejecutar `database/schema.sql`.
3. Ejecutar `database/rls-policies.sql`.
4. Ejecutar `database/seed.sql`.
5. Confirmar buckets privados `rit-documents` y `reports`.
6. Crear usuario admin/reviewer en Auth y asignar `app_metadata.role = admin`.

## Railway Backend

- Servicio API:
  - Root: `backend`
  - Build: `npm install && npm run build`
  - Start: `npm run start`
- Servicio worker analysis:
  - Root: `backend`
  - Start: `npm run worker:analysis`
- Servicio worker cleanup:
  - Root: `backend`
  - Start: `npm run worker:cleanup`
- Redis: plugin Railway o servicio gestionado.

## Vercel Frontend

- Root: `frontend`
- Build: `npm run build`
- Variables `NEXT_PUBLIC_*`.
- Dominio: `ritcheck.co` o subdominio aprobado.

## Bold

1. Crear comercio y llaves sandbox/produccion.
2. Configurar webhook a `https://api.ritcheck.co/api/webhooks/bold`.
3. Probar pagos PSE, tarjeta y medios disponibles.
4. Validar idempotencia y conciliacion.

## Resend

1. Verificar dominio de envio.
2. Configurar SPF, DKIM y DMARC.
3. Probar templates con datos reales no sensibles.

## CI/CD TODO

- TODO: agregar GitHub Actions con `npm ci`, lint, typecheck y tests por paquete.
- TODO: bloquear deploy si migraciones SQL fallan.
- TODO: ejecutar pruebas de webhooks con fixtures firmados.
- TODO: automatizar smoke test post-deploy.

## Rollback

- Frontend: rollback Vercel instantaneo.
- Backend: rollback Railway a deploy anterior.
- DB: migraciones reversibles; no usar cambios destructivos sin backup.
- Prompts: versionar en codigo y registrar `prompt_version` en `ai_model_runs`.

