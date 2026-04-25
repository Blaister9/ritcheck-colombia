// ==========================================
// ARCHIVO: frontend/src/app/page.tsx
// PROPOSITO: Landing principal con propuesta de valor y seleccion de planes
// DEPENDENCIAS: PricingCard, tipos de planes
// LLAMADO DESDE: Ruta /
// ==========================================

import { PricingCard } from '@/components/PricingCard';

const plans = [
  {
    id: 'basic',
    name: 'Diagnostico RIT',
    priceCop: 149000,
    description: 'Score de cumplimiento y checklist priorizado para PYMEs.',
  },
  {
    id: 'pro',
    name: 'RITCheck Pro',
    priceCop: 249000,
    description: 'Incluye textos juridicos sugeridos y plan de accion.',
    highlighted: true,
  },
  {
    id: 'premium',
    name: 'Revision prioritaria',
    priceCop: 399000,
    description: 'Reporte completo con revision humana en el MVP.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-secondary">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">Ley 2466 de 2025</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
              RITCheck Colombia
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Analisis IA de Reglamentos Internos de Trabajo para PYMEs colombianas, con reporte PDF accionable antes del 25 de junio de 2026.
            </p>
          </div>
          <div className="rounded-md border bg-card p-6 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Entregable</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>Score de cumplimiento por categoria.</li>
              <li>Cambios obligatorios priorizados.</li>
              <li>Texto juridico sugerido listo para copiar.</li>
              <li>Checklist y plan de accion con fechas.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>
    </main>
  );
}

