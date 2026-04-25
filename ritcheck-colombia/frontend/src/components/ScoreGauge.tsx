// ==========================================
// ARCHIVO: frontend/src/components/ScoreGauge.tsx
// PROPOSITO: Gauge circular SVG animado con colores por umbral
//   (rojo / ambar / verde) para visualizar el score de cumplimiento.
// DEPENDENCIAS: React
// LLAMADO DESDE: ReportPreview y app/resultado/[orderId]/page.tsx
// ==========================================

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  /** Texto pequeno bajo el numero (ej: "Cumplimiento Ley 2466"). */
  label?: string;
  /** Diametro en px del gauge. */
  size?: number;
  /** Si true, anima el numero de 0 al score final. */
  animate?: boolean;
}

const STROKE = 14;

export function ScoreGauge({
  score,
  label = 'Cumplimiento Ley 2466',
  size = 220,
  animate = true,
}: ScoreGaugeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const [displayed, setDisplayed] = useState(animate ? 0 : normalizedScore);

  useEffect(() => {
    if (!animate) {
      setDisplayed(normalizedScore);
      return;
    }
    const durationMs = 1100;
    const startedAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(normalizedScore * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [normalizedScore, animate]);

  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - displayed / 100);

  const tone = scoreTone(normalizedScore);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Puntaje ${normalizedScore} de 100`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--secondary))"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tone.stroke}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: animate ? 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' : undefined }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-5xl font-extrabold tracking-tight', tone.text)}>
            {displayed}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">de 100</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-1 text-center">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
            tone.badgeBg,
            tone.badgeText,
          )}
        >
          {tone.label}
        </span>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      stroke: 'hsl(152 50% 32%)',
      text: 'text-success',
      badgeBg: 'bg-success/10',
      badgeText: 'text-success',
      label: 'Cumplimiento alto',
    };
  }
  if (score >= 60) {
    return {
      stroke: 'hsl(38 75% 48%)',
      text: 'text-warning',
      badgeBg: 'bg-warning/10',
      badgeText: 'text-warning',
      label: 'Cumplimiento parcial',
    };
  }
  return {
    stroke: 'hsl(0 70% 45%)',
    text: 'text-destructive',
    badgeBg: 'bg-destructive/10',
    badgeText: 'text-destructive',
    label: 'Riesgo alto',
  };
}
