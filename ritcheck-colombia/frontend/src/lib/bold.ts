// ==========================================
// ARCHIVO: frontend/src/lib/bold.ts
// PROPOSITO: Helpers para iniciar pagos Bold desde el frontend
// DEPENDENCIAS: API backend, variables NEXT_PUBLIC_BOLD_PUBLIC_KEY
// LLAMADO DESDE: pago/page.tsx y componentes de checkout
// ==========================================

export interface BoldCheckoutPayload {
  orderId: string;
  amountCop: number;
  customerEmail: string;
  customerName?: string;
}

export async function createBoldCheckoutSession(payload: BoldCheckoutPayload): Promise<{ redirectUrl: string }> {
  // TODO: llamar backend POST /api/payments/bold/session para crear preferencia firmada.
  // TODO: nunca calcular montos finales solo en cliente; backend debe derivar precio por plan.
  return {
    redirectUrl: `/pago?orderId=${payload.orderId}&status=TODO`,
  };
}

export function validateBoldPublicConfig(): boolean {
  // TODO: verificar presencia de NEXT_PUBLIC_BOLD_PUBLIC_KEY y modo sandbox/produccion.
  return Boolean(process.env.NEXT_PUBLIC_BOLD_PUBLIC_KEY);
}

