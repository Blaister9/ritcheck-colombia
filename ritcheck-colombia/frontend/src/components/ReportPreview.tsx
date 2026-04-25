// ==========================================
// ARCHIVO: frontend/src/components/ReportPreview.tsx
// PROPOSITO: Componente compacto para previsualizar el reporte (uso futuro
//   cuando expongamos el endpoint de preview detallado).
// DEPENDENCIAS: ScoreGauge, ChecklistItem
// LLAMADO DESDE: Reservado para iteraciones posteriores del flujo de
//   resultados; en MVP la pagina /resultado/[orderId] arma su propio layout.
// ==========================================

import { Download } from 'lucide-react';
import { ChecklistItem } from './ChecklistItem';
import { ScoreGauge } from './ScoreGauge';
import type { Severity } from '@/types';

export interface ReportPreviewItem {
  title: string;
  description: string;
  severity: Severity;
}

interface ReportPreviewProps {
  orderId: string;
  score: number;
  summary: string;
  items: ReportPreviewItem[];
  downloadUrl?: string;
}

export function ReportPreview({ orderId, score, summary, items, downloadUrl }: ReportPreviewProps) {
  return (
    <section className="grid gap-6 md:grid-cols-[320px_1fr]">
      <ScoreGauge score={score} />
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Resumen ejecutivo</h2>
            <p className="text-sm text-muted-foreground">
              Orden <span className="font-mono">{orderId.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>
          {downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-4 w-4" aria-hidden />
              Descargar PDF
            </a>
          )}
        </header>
        <p className="text-sm text-muted-foreground">{summary}</p>
        <div className="space-y-3">
          {items.map((item) => (
            <ChecklistItem
              key={item.title}
              title={item.title}
              description={item.description}
              severity={item.severity}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
