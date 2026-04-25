<!--
==========================================
ARCHIVO: docs/api-endpoints.md
PROPOSITO: Especifica todos los endpoints REST, auth, rate limits y schemas
DEPENDENCIAS: backend/src/routes
LLAMADO DESDE: Implementadores frontend/backend
==========================================
-->

# API REST

Base URL local: `http://localhost:4000/api`

## Rate Limits

| Endpoint | Limite |
| --- | --- |
| Global | 120 req/min/IP |
| `POST /orders` | 10 req/10 min/IP |
| `POST /uploads/:orderId` | 5 req/hora/IP |
| `GET /orders/:orderId/status` | 30 req/min/IP |
| `GET /orders/:orderId/report` | 30 req/min/IP |
| `POST /webhooks/bold` | 300 req/min/IP |

## `GET /health`

- Auth: no.
- Response `200`: `{ ok, service, redis, timestamp }`.
- TODO: agregar `GET /health/ready` con pings reales.

## `POST /orders`

- Auth: opcional en MVP; recomendado Supabase Auth antes de produccion.
- Body:

```json
{
  "planId": "pro",
  "customerEmail": "cliente@empresa.com",
  "customerName": "Nombre Cliente",
  "companyName": "Empresa SAS",
  "companyNit": "900123456-7"
}
```

- Response `201`:

```json
{
  "orderId": "uuid",
  "status": "pending_payment",
  "amountCop": 249000,
  "checkoutUrl": "https://..."
}
```

- Validaciones: plan permitido, email valido, NIT opcional con formato basico, monto derivado desde backend.

## `GET /orders/:orderId/status`

- Auth: token firmado de orden o Supabase Auth.
- Params: `orderId` UUID.
- Response `200`:

```json
{
  "orderId": "uuid",
  "status": "processing",
  "updatedAt": "2026-04-25T18:00:00.000Z",
  "message": "Analisis en curso"
}
```

## `GET /orders/:orderId/report`

- Auth: token firmado de orden o Supabase Auth.
- Response `200`:

```json
{
  "orderId": "uuid",
  "status": "completed",
  "downloadUrl": "https://signed-url",
  "expiresInSeconds": 604800
}
```

- Reglas: solo si orden `completed`; links firmados; no exponer storage path bruto.

## `POST /uploads/:orderId`

- Auth: token firmado de orden o Supabase Auth.
- Content-Type: `multipart/form-data`.
- Field: `document`.
- MIME permitidos: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Max: 15 MB.
- Response `202`:

```json
{
  "orderId": "uuid",
  "documentId": "uuid",
  "status": "uploaded"
}
```

- Reglas: orden debe estar `paid`; rechazar doble upload salvo reintento controlado; calcular SHA-256.

## `POST /webhooks/bold`

- Auth: firma HMAC Bold.
- Content-Type: raw body.
- Headers: `X-Bold-Signature`.
- Response `200`: `{ "received": true }`.
- Reglas:
  - Validar firma con raw body.
  - Validar monto y moneda contra `orders`.
  - Validar idempotencia por `provider_event_id`.
  - Ignorar eventos duplicados.
  - No confiar en estado enviado por frontend.

## Endpoints internos futuros

- `POST /internal/orders/:orderId/approve`: aprobacion manual de reporte.
- `POST /internal/orders/:orderId/retry`: reintento de job fallido.
- `GET /internal/queue/metrics`: metricas operativas.

## TODO

- TODO: definir esquema OpenAPI 3.1 en `docs/openapi.yaml`.
- TODO: implementar tokens firmados de orden para usuarios sin cuenta.

