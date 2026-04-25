// ==========================================
// ARCHIVO: frontend/src/components/ChecklistItem.tsx
// PROPOSITO: Renderiza un item accionable del checklist del reporte con
//   indicador visual por severidad.
// DEPENDENCIAS: lucide-react, lib/utils
// LLAMADO DESDE: app/resultado/[orderId]/page.tsx
// ==========================================

import { AlertOctagon, AlertTriangle, CircleCheck, Info } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import type { Severity } from '@/types';

interface ChecklistItemProps {
  title: string;
  description: string;
  severity?: Severity;
  ownerRole?: string;
  dueDate?: string;
  done?: boolean;
}

const SEVERITY_ICON: Record<Severity, ComponentType<SVGProps<SVGSVGElement>>> = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: Info,
  low: Info,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const SEVERITY_TONE: Record<Severity, { border: string; pillBg: string; pillText: string; icon: string }> = {
  critical: {
    border: 'border-l-destructive',
    pillBg: 'bg-destructive/10',
    pillText: 'text-destructive',
    icon: 'text-destructive',
  },
  high: {
    border: 'border-l-warning',
    pillBg: 'bg-warning/10',
    pillText: 'text-warning',
    icon: 'text-warning',
  },
  medium: {
    border: 'border-l-primary',
    pillBg: 'bg-primary/10',
    pillText: 'text-primary',
    icon: 'text-primary',
  },
  low: {
    border: 'border-l-muted-foreground',
    pillBg: 'bg-secondary',
    pillText: 'text-muted-foreground',
    icon: 'text-muted-foreground',
  },
};

export function ChecklistItem({
  title,
  description,
  severity = 'medium',
  ownerRole,
  dueDate,
  done = false,
}: ChecklistItemProps) {
  const tone = SEVERITY_TONE[severity];
  const Icon = done ? CircleCheck : SEVERITY_ICON[severity];

  return (
    <article
      className={cn(
        'rounded-xl border border-l-4 bg-card p-4 shadow-card transition',
        tone.border,
        done && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', done ? 'text-success' : tone.icon)} aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{title}</p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                tone.pillBg,
                tone.pillText,
              )}
            >
              {SEVERITY_LABEL[severity]}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          {(ownerRole || dueDate) && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              {ownerRole && (
                <span>
                  Responsable sugerido:{' '}
                  <span className="font-semibold text-foreground">{ownerRole}</span>
                </span>
              )}
              {dueDate && (
                <span>
                  Plazo sugerido:{' '}
                  <span className="font-semibold text-foreground">{dueDate}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
