// ==========================================
// ARCHIVO: frontend/src/lib/api.ts
// PROPOSITO: Cliente HTTP tipado para comunicarse con el backend Express.
//   Maneja errores ApiErrorPayload, agrega el orderToken (HMAC firmado en
//   backend) en headers para autorizar status/report sin login y normaliza
//   la URL base via NEXT_PUBLIC_API_URL.
// DEPENDENCIAS: fetch, tipos frontend
// LLAMADO DESDE: Paginas y componentes frontend
// ==========================================

import type {
  ApiErrorPayload,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderReportResponse,
  OrderStatusResponse,
  UploadDocumentResponse,
} from '@/types';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:4000/api'
);

const ORDER_TOKEN_STORAGE_PREFIX = 'ritcheck:orderToken:';
const ORDER_LAST_KEY = 'ritcheck:lastOrderId';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly payload?: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload | undefined, fallback: string) {
    super(payload?.message || fallback);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code ?? 'UNKNOWN';
    this.payload = payload;
  }
}

interface RequestOptions {
  signal?: AbortSignal;
  /** Token firmado del orden (HMAC) cuando el usuario es anonimo. */
  orderToken?: string;
}

async function request<T>(path: string, init: RequestInit, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (options.orderToken) headers.set('X-Order-Token', options.orderToken);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: options.signal,
      credentials: 'omit',
    });
  } catch (err) {
    // Errores de red, CORS o aborto.
    if ((err as Error).name === 'AbortError') {
      throw err;
    }
    throw new ApiError(0, undefined, 'No fue posible contactar el servidor. Revisa tu conexion.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const payload = (typeof body === 'object' ? body : undefined) as ApiErrorPayload | undefined;
    throw new ApiError(response.status, payload, `Error ${response.status}`);
  }

  return body as T;
}

// ---- Orders ----

export async function createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  const result = await request<CreateOrderResponse>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Guardar el token firmado y el checkout context para que las paginas
  // siguientes (status, report, pago) puedan autorizar y mostrar el monto/URL
  // sin necesidad de re-fetch. Solo en cliente.
  if (typeof window !== 'undefined') {
    if (result.orderToken) {
      saveOrderToken(result.orderId, result.orderToken);
      window.localStorage.setItem(ORDER_LAST_KEY, result.orderId);
    }
    try {
      window.localStorage.setItem(
        `ritcheck:order:${result.orderId}`,
        JSON.stringify({ amountCop: result.amountCop, checkoutUrl: result.checkoutUrl }),
      );
    } catch {
      // localStorage puede fallar en modo privado; los flujos no dependen de esto.
    }
  }

  return result;
}

export async function getOrderStatus(
  orderId: string,
  options: RequestOptions = {},
): Promise<OrderStatusResponse> {
  const orderToken = options.orderToken ?? loadOrderToken(orderId);
  return request<OrderStatusResponse>(`/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'GET',
  }, { ...options, orderToken });
}

export async function getOrderReport(
  orderId: string,
  options: RequestOptions = {},
): Promise<OrderReportResponse> {
  const orderToken = options.orderToken ?? loadOrderToken(orderId);
  return request<OrderReportResponse>(`/orders/${encodeURIComponent(orderId)}/report`, {
    method: 'GET',
  }, { ...options, orderToken });
}

// ---- Uploads ----

export async function uploadDocument(
  orderId: string,
  file: File,
  options: { onProgress?: (percent: number) => void; orderToken?: string } = {},
): Promise<UploadDocumentResponse> {
  const orderToken = options.orderToken ?? loadOrderToken(orderId);
  const formData = new FormData();
  formData.append('document', file);

  // Usamos XHR cuando hay onProgress porque fetch no expone progreso de upload.
  if (options.onProgress) {
    return new Promise<UploadDocumentResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/uploads/${encodeURIComponent(orderId)}`);
      if (orderToken) xhr.setRequestHeader('X-Order-Token', orderToken);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          options.onProgress?.(Math.min(99, pct));
        }
      };

      xhr.onload = () => {
        try {
          const body = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
          if (xhr.status >= 200 && xhr.status < 300) {
            options.onProgress?.(100);
            resolve(body as UploadDocumentResponse);
          } else {
            reject(new ApiError(xhr.status, body as ApiErrorPayload, `Error ${xhr.status}`));
          }
        } catch {
          reject(new ApiError(xhr.status, undefined, 'Respuesta invalida del servidor.'));
        }
      };

      xhr.onerror = () => reject(new ApiError(0, undefined, 'Fallo la subida del documento.'));
      xhr.onabort = () => reject(new ApiError(0, undefined, 'Subida cancelada.'));
      xhr.send(formData);
    });
  }

  return request<UploadDocumentResponse>(`/uploads/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    body: formData,
  }, { orderToken });
}

// ---- Token storage helpers ----

export function saveOrderToken(orderId: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${ORDER_TOKEN_STORAGE_PREFIX}${orderId}`, token);
  } catch {
    // localStorage puede estar deshabilitado (Safari modo privado, cookies bloqueadas);
    // los flujos siguen funcionando con el token en URL como fallback.
  }
}

export function loadOrderToken(orderId: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(`${ORDER_TOKEN_STORAGE_PREFIX}${orderId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export function getLastOrderId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(ORDER_LAST_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

// ---- Estado humanizable ----

const STATUS_LABELS: Record<OrderStatusResponse['status'], string> = {
  pending_payment: 'Esperando pago',
  paid: 'Pago confirmado',
  uploaded: 'Documento recibido',
  processing: 'Analisis en curso',
  manual_review: 'En revision por equipo legal',
  completed: 'Reporte listo',
  failed: 'Hubo un problema',
  expired: 'Orden expirada',
};

export function statusLabel(status: OrderStatusResponse['status']): string {
  return STATUS_LABELS[status] ?? status;
}
