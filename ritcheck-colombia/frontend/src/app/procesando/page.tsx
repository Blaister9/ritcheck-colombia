// ==========================================
// ARCHIVO: frontend/src/app/procesando/page.tsx
// PROPOSITO: Pantalla de espera mientras el worker procesa el RIT
// DEPENDENCIAS: OrderStatus
// LLAMADO DESDE: Ruta /procesando
// ==========================================

import { OrderStatus } from '@/components/OrderStatus';

export default function ProcessingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold">Estamos analizando tu RIT</h1>
      <p className="mt-3 text-muted-foreground">
        El analisis puede tardar varios minutos. Te enviaremos un correo cuando el reporte este listo.
      </p>
      <div className="mt-8">
        <OrderStatus orderId="TODO_ORDER_ID" />
      </div>
    </main>
  );
}

