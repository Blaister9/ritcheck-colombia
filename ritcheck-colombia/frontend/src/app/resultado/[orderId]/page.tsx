// ==========================================
// ARCHIVO: frontend/src/app/resultado/[orderId]/page.tsx
// PROPOSITO: Muestra resumen del resultado y descarga segura del PDF
// DEPENDENCIAS: ReportPreview, API backend
// LLAMADO DESDE: Ruta /resultado/[orderId]
// ==========================================

import { ReportPreview } from '@/components/ReportPreview';

interface ResultPageProps {
  params: {
    orderId: string;
  };
}

export default function ResultPage({ params }: ResultPageProps) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Reporte</p>
      <h1 className="mt-3 text-3xl font-bold">Resultado del analisis</h1>
      <p className="mt-2 text-sm text-muted-foreground">Orden: {params.orderId}</p>
      <div className="mt-8">
        <ReportPreview orderId={params.orderId} />
      </div>
    </main>
  );
}

