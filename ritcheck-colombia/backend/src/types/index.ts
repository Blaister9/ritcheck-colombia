// ==========================================
// ARCHIVO: backend/src/types/index.ts
// PROPOSITO: Tipos de dominio para ordenes, documentos, IA y reportes
// DEPENDENCIAS: Ninguna
// LLAMADO DESDE: Rutas, servicios, workers y prompts
// ==========================================

export type PlanId = 'basic' | 'pro' | 'premium';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'uploaded'
  | 'processing'
  | 'manual_review'
  | 'completed'
  | 'failed'
  | 'expired';

export type PaymentProvider = 'bold' | 'wompi';
export type PaymentStatus = 'pending' | 'approved' | 'declined' | 'voided' | 'error';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ModelProvider = 'claude' | 'openai';

export interface CustomerInfo {
  email: string;
  name?: string;
  companyName?: string;
  companyNit?: string;
}

export interface Order {
  id: string;
  planId: PlanId;
  status: OrderStatus;
  amountCop: number;
  customer: CustomerInfo;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  completedAt?: string;
}

export interface UploadedDocument {
  id: string;
  orderId: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  deleteAfter: string;
}

export interface ParsedDocument {
  orderId: string;
  text: string;
  pageCount?: number;
  wordCount: number;
  parser: 'pdf-parse' | 'mammoth';
}

export interface LegalFinding {
  id: string;
  title: string;
  severity: Severity;
  legalBasis: string;
  currentTextExcerpt?: string;
  issue: string;
  risk: string;
  suggestedText: string;
  confidence: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  dueDate?: string;
  ownerRole?: string;
}

export interface ActionPlanItem {
  id: string;
  action: string;
  priority: number;
  dueDate: string;
  rationale: string;
}

export interface ModelUsage {
  provider: ModelProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface ClaudeAnalysisResult {
  provider: 'claude';
  score: number;
  executiveSummary: string;
  findings: LegalFinding[];
  checklist: ChecklistItem[];
  actionPlan: ActionPlanItem[];
  usage: ModelUsage;
  rawResponseId?: string;
}

export interface OpenAICritiqueResult {
  provider: 'openai';
  challengedFindings: Array<{
    findingId?: string;
    concern: string;
    suggestedCorrection: string;
    severityAdjustment?: Severity;
  }>;
  missingRisks: LegalFinding[];
  scoreAdjustment: number;
  usage: ModelUsage;
  rawResponseId?: string;
}

export interface CombinedAnalysisResult {
  orderId: string;
  score: number;
  executiveSummary: string;
  findings: LegalFinding[];
  checklist: ChecklistItem[];
  actionPlan: ActionPlanItem[];
  modelUsage: ModelUsage[];
  requiresManualReview: boolean;
}

export interface AnalysisJobData {
  orderId: string;
  documentId: string;
  planId: PlanId;
  customerEmail: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

// TODO: extraer tipos compartidos frontend/backend a paquete interno cuando se cree monorepo formal.

