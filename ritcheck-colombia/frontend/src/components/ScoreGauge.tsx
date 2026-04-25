// ==========================================
// ARCHIVO: frontend/src/components/ScoreGauge.tsx
// PROPOSITO: Visualiza score de cumplimiento del reporte
// DEPENDENCIAS: React
// LLAMADO DESDE: ReportPreview y paginas de resultado
// ==========================================

interface ScoreGaugeProps {
  score: number;
  label?: string;
}

export function ScoreGauge({ score, label = 'Cumplimiento' }: ScoreGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, score));

  return (
    <div className="rounded-md border bg-card p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-4xl font-bold">{normalizedScore}</span>
        <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
      </div>
      <div className="mt-4 h-2 rounded-sm bg-secondary">
        <div className="h-2 rounded-sm bg-primary" style={{ width: `${normalizedScore}%` }} />
      </div>
      {/* TODO: reemplazar barra simple por gauge accesible con thresholds visuales. */}
    </div>
  );
}

