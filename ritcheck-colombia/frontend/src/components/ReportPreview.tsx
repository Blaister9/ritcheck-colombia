// ==========================================
// ARCHIVO: frontend/src/components/ReportPreview.tsx
// PROPOSITO: Previsualiza score, hallazgos y descarga del PDF
// DEPENDENCIAS: ScoreGauge, ChecklistItem, API backend
// LLAMADO DESDE: resultado/[orderId]/page.tsx
// ==========================================

import { Download } from 'lucide-react';
import { ChecklistItem } from './ChecklistItem';
import { ScoreGauge } from './ScoreGauge';
import { Button } from './ui/button';

interface ReportPreviewProps {
  orderId: string;
}

export function ReportPreview({ orderId }: ReportPreviewProps) {
  // TODO: consultar GET /api/orders/:orderId/report y renderizar datos reales.
  return (
    <section className="grid gap-6 md:grid-cols-[320px_1fr]">
      <ScoreGauge score={72} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Resumen ejecutivo</h2>
            <p className="text-sm text-muted-foreground">Orden {orderId}</p>
          </div>
          <Button type="button">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Descargar PDF
          </Button>
        </div>
        <ChecklistItem
          title="Actualizar procedimiento disciplinario"
          description="Debe incluir garantias de defensa, contradiccion, imparcialidad y ajustes razonables."
          priority="high"
        />
        <ChecklistItem
          title="Revisar jornada y recargos"
          description="Validar redaccion frente a cambios de jornada, trabajo nocturno y recargos graduales."
          priority="medium"
        />
      </div>
    </section>
  );
}

