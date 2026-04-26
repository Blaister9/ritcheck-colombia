// ==========================================
// ARCHIVO: frontend/src/components/ScoreGauge.tsx
// PROPOSITO: Visualiza el score como barra horizontal accionable, con puntos
//   incumplidos y estimacion de tiempo de correccion.
// DEPENDENCIAS: React, utils cn
// LLAMADO DESDE: ReportPreview y app/resultado/[orderId]/page.tsx
// ==========================================

import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  label?: string;
  failedPoints?: number;
  totalPoints?: number;
  correctionEstimate?: string;
}

export function ScoreGauge({
  score,
  label = 'Score de cumplimiento Ley 2466',
  failedPoints,
  totalPoints = 47,
  correctionEstimate = '4-6 horas de corrección',
}: ScoreGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const calculatedFailedPoints =
    failedPoints ?? Math.max(0, Math.min(totalPoints, Math.round(totalPoints * (1 - normalizedScore / 100))));
  const tone = scoreTone(normalizedScore);

  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-primary">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Punto de partida medible para priorizar la corrección.
          </p>
        </div>
        <span className={cn('rounded-md px-3 py-1 text-xs font-bold', tone.badge)}>
          {tone.label}
        </span>
      </div>

      <div className="mt-6">
        <div className="h-4 overflow-hidden rounded-sm bg-muted" aria-hidden>
          <div className={cn('h-full rounded-sm', tone.bar)} style={{ width: `${normalizedScore}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <p className={cn('text-5xl font-extrabold leading-none', tone.text)}>
            {normalizedScore}/100
          </p>
          <p className="text-sm font-semibold text-muted-foreground">
            {calculatedFailedPoints} de {totalPoints} puntos incumplidos
          </p>
        </div>
      </div>

      <p className="mt-4 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
        Estimamos {correctionEstimate} con el texto sugerido en este reporte.
      </p>
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      bar: 'bg-success',
      text: 'text-success',
      badge: 'bg-success/10 text-success',
      label: 'Cumplimiento alto',
    };
  }
  if (score >= 60) {
    return {
      bar: 'bg-accent',
      text: 'text-primary',
      badge: 'bg-accent/20 text-primary',
      label: 'Cumplimiento parcial',
    };
  }
  return {
    bar: 'bg-destructive',
    text: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
    label: 'Riesgo alto',
  };
}
