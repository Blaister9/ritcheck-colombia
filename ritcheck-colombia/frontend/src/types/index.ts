// ==========================================
// ARCHIVO: frontend/src/types/index.ts
// PROPOSITO: Tipos TypeScript compartidos por el frontend, alineados con el
//   contrato actual del backend Express en /api/orders, /api/uploads y
//   /api/webhooks/bold.
// DEPENDENCIAS: Ninguna
// LLAMADO DESDE: Componentes, paginas y cliente API
// ==========================================

export type PlanId = 'basic' | 'pro' | 'premium';

export type OrderStatusValue =
  | 'pending_payment'
  | 'paid'
  | 'uploaded'
  | 'processing'
  | 'manual_review'
  | 'completed'
  | 'failed'
  | 'expired';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface CreateOrderRequest {
  planId: PlanId;
  customerEmail: string;
  customerName?: string;
  companyName?: string;
  companyNit?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  status: OrderStatusValue;
  amountCop: number;
  checkoutUrl: string;
  /** Token HMAC firmado para autorizar GET /status y /report sin login. */
  orderToken: string;
}

export interface OrderStatusResponse {
  orderId: string;
  status: OrderStatusValue;
  updatedAt: string;
  message?: string;
}

export interface OrderReportResponse {
  orderId: string;
  status: OrderStatusValue;
  /** Solo presente cuando status === 'completed'. */
  downloadUrl?: string;
  expiresInSeconds?: number;
  expiresAt?: string;
  message?: string;
}

export interface UploadDocumentResponse {
  orderId: string;
  documentId: string;
  status: 'uploaded';
}

export interface ReportFinding {
  id: string;
  title: string;
  severity: Severity;
  legalBasis: string;
  /** Texto del RIT actual que dispara el hallazgo (puede venir vacio). */
  currentTextExcerpt?: string;
  /** Descripcion del problema legal. */
  issue: string;
  /** Riesgo concreto para la empresa. */
  risk: string;
  /** Texto sugerido para reemplazar/incluir en el RIT. */
  suggestedText: string;
  confidence: number;
}

export interface ReportChecklistItem {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  dueDate?: string;
  ownerRole?: string;
}

export interface ReportActionItem {
  id: string;
  action: string;
  priority: number;
  dueDate: string;
  rationale: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

// TODO: alinear estos tipos con backend/src/types/index.ts mediante paquete
// compartido en V2 (packages/contracts).
