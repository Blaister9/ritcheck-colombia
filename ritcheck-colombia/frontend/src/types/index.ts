// ==========================================
// ARCHIVO: frontend/src/types/index.ts
// PROPOSITO: Tipos TypeScript compartidos por el frontend
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
  checkoutUrl?: string;
}

export interface OrderStatusResponse {
  orderId: string;
  status: OrderStatusValue;
  updatedAt: string;
  message?: string;
}

export interface ReportSummary {
  orderId: string;
  score: number;
  completedAt: string;
  downloadUrl?: string;
  findings: ReportFinding[];
}

export interface ReportFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  legalBasis: string;
  currentRisk: string;
  suggestedText: string;
  actionDueDate?: string;
}

// TODO: alinear estos tipos con backend/src/types/index.ts mediante paquete compartido en V2.

