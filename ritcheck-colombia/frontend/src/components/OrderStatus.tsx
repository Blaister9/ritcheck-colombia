// ==========================================
// ARCHIVO: frontend/src/components/OrderStatus.tsx
// PROPOSITO: Muestra estado actual de una orden y sus pasos
// DEPENDENCIAS: API backend, tipos OrderStatus
// LLAMADO DESDE: procesando/page.tsx y resultado/[orderId]/page.tsx
// ==========================================

import { Loader2 } from 'lucide-react';
import type { OrderStatusValue } from '@/types';

interface OrderStatusProps {
  orderId: string;
  status?: OrderStatusValue;
}

export function OrderStatus({ orderId, status = 'processing' }: OrderStatusProps) {
  return (
    <div className="rounded-md border bg-card p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">Estado: {status}</p>
          <p className="text-sm text-muted-foreground">Orden {orderId}</p>
        </div>
      </div>
      {/* TODO: hacer polling seguro a GET /api/orders/:orderId/status cada 10-15 segundos. */}
    </div>
  );
}

