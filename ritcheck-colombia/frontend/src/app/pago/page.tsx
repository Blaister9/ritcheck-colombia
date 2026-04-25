// ==========================================
// ARCHIVO: frontend/src/app/pago/page.tsx
// PROPOSITO: Pantalla de confirmacion y redireccion a Bold Checkout
// DEPENDENCIAS: lib/bold, API de ordenes
// LLAMADO DESDE: Ruta /pago
// ==========================================

import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-3xl font-bold">Pago seguro con Bold</h1>
      <p className="mt-3 text-muted-foreground">
        Paga con PSE, tarjeta o medios habilitados por Bold. Al confirmarse el pago, habilitaremos la carga del RIT.
      </p>
      <Button className="mt-8 w-fit" type="button">
        Continuar al pago
      </Button>
      {/* TODO: conectar este boton con createBoldCheckoutSession(planId, orderId). */}
    </main>
  );
}

