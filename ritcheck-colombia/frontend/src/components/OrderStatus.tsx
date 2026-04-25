// ==========================================
// ARCHIVO: frontend/src/components/OrderStatus.tsx
// PROPOSITO: Timeline visual del estado de una orden, con animaciones para el
//   paso activo y semantica accesible.
// DEPENDENCIAS: lucide-react, lib/utils
// LLAMADO DESDE: app/procesando/page.tsx
// ==========================================

'use client';

import { Check, ClipboardCheck, FileSearch, FileText, Mail } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import type { OrderStatusValue } from '@/types';

interface Step {
  key: 'paid' | 'uploaded' | 'processing' | 'manual_review' | 'completed';
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const STEPS: Step[] = [
  {
    key: 'paid',
    title: 'Pago confirmado',
    description: 'Bold confirmo el pago de tu orden.',
    icon: Check,
  },
  {
    key: 'uploaded',
    title: 'Documento recibido',
    description: 'Tu RIT esta en almacenamiento privado, listo para analizar.',
    icon: FileText,
  },
  {
    key: 'processing',
    title: 'Analisis en curso',
    description: 'Estamos comparando articulo por articulo contra la Ley 2466 y el CST.',
    icon: FileSearch,
  },
  {
    key: 'manual_review',
    title: 'Revision por equipo legal',
    description: 'Validamos las recomendaciones automaticas antes de la entrega.',
    icon: ClipboardCheck,
  },
  {
    key: 'completed',
    title: 'Reporte listo',
    description: 'Te enviamos un correo con el enlace seguro de descarga.',
    icon: Mail,
  },
];

const ORDER: OrderStatusValue[] = [
  'pending_payment',
  'paid',
  'uploaded',
  'processing',
  'manual_review',
  'completed',
];

export function OrderStatusTimeline({ status }: { status: OrderStatusValue }) {
  return (
    <ol className="space-y-4">
      {STEPS.map((step) => {
        const state = computeStepState(step.key, status);
        return <TimelineRow key={step.key} step={step} state={state} />;
      })}
    </ol>
  );
}

interface TimelineRowProps {
  step: Step;
  state: 'pending' | 'active' | 'done';
}

function TimelineRow({ step, state }: TimelineRowProps) {
  const Icon = step.icon;
  return (
    <li
      className={cn(
        'flex items-start gap-4 rounded-xl border bg-card p-4 transition',
        state === 'done' && 'border-success/30 bg-success/5',
        state === 'active' && 'border-primary/40 bg-primary/[0.04] shadow-card',
        state === 'pending' && 'border-border opacity-70',
      )}
      aria-current={state === 'active' ? 'step' : undefined}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          state === 'done' && 'bg-success text-white',
          state === 'active' && 'bg-primary text-primary-foreground animate-pulse-soft',
          state === 'pending' && 'bg-secondary text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p
          className={cn(
            'text-sm font-semibold',
            state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {step.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
      </div>
      {state === 'done' && (
        <span className="text-xs font-semibold uppercase tracking-wide text-success">
          Listo
        </span>
      )}
      {state === 'active' && (
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          En curso
        </span>
      )}
    </li>
  );
}

function computeStepState(
  stepKey: Step['key'],
  status: OrderStatusValue,
): TimelineRowProps['state'] {
  // failed/expired: marcamos todo lo previo como hecho hasta donde llego.
  if (status === 'failed' || status === 'expired') {
    return 'pending';
  }
  const stepIndex = ORDER.indexOf(stepKey);
  const statusIndex = ORDER.indexOf(status);

  if (statusIndex >= stepIndex + 1) return 'done';
  if (statusIndex === stepIndex) return 'active';

  // Si la orden ya esta `completed`, todos los pasos previos son done.
  if (status === 'completed') return 'done';
  return 'pending';
}
