// ==========================================
// ARCHIVO: frontend/src/components/PricingCard.tsx
// PROPOSITO: Tarjeta de plan y precio en COP
// DEPENDENCIAS: Button, formato Intl
// LLAMADO DESDE: Landing page
// ==========================================

import Link from 'next/link';
import { Button } from './ui/button';

interface PricingPlan {
  id: string;
  name: string;
  priceCop: number;
  description: string;
  highlighted?: boolean;
}

interface PricingCardProps {
  plan: PricingPlan;
}

export function PricingCard({ plan }: PricingCardProps) {
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(plan.priceCop);

  return (
    <article className={plan.highlighted ? 'rounded-md border-2 border-primary bg-card p-5' : 'rounded-md border bg-card p-5'}>
      <h2 className="text-xl font-semibold">{plan.name}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
      <p className="mt-5 text-3xl font-bold">{formattedPrice}</p>
      <Button asChild className="mt-6 w-full">
        <Link href={`/pago?plan=${plan.id}`}>Elegir plan</Link>
      </Button>
      {/* TODO: crear orden antes de navegar a pago para asegurar trazabilidad. */}
    </article>
  );
}

