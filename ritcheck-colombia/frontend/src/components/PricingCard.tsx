// ==========================================
// ARCHIVO: frontend/src/components/PricingCard.tsx
// PROPOSITO: Card de plan con precio COP, features y CTA que crea la orden
//   en el backend y redirige a /pago.
// DEPENDENCIAS: React, Next.js router, lib/api, lib/utils, lucide-react
// LLAMADO DESDE: app/page.tsx (landing)
// ==========================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { ApiError, createOrder } from '@/lib/api';
import { cn, formatCop } from '@/lib/utils';
import type { PlanId } from '@/types';

export interface PricingPlan {
  id: PlanId;
  name: string;
  audience: string;
  amountCop: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  sla?: string;
}

interface PricingCardProps {
  plan: PricingPlan;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NIT_REGEX = /^[0-9.-]{6,20}$/;

export function PricingCard({ plan }: PricingCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    companyName: '',
    companyNit: '',
  });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(form.customerEmail.trim())) {
      setError('Ingresa un correo valido. Allí enviaremos la confirmacion y el reporte.');
      return;
    }
    if (form.companyNit && !NIT_REGEX.test(form.companyNit.trim())) {
      setError('NIT con formato invalido. Usa solo numeros, puntos y guion.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        planId: plan.id,
        customerEmail: form.customerEmail.trim(),
        customerName: form.customerName.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        companyNit: form.companyNit.trim() || undefined,
      });
      router.push(`/pago?orderId=${encodeURIComponent(order.orderId)}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No fue posible crear la orden. Intenta nuevamente en unos segundos.');
      }
      setSubmitting(false);
    }
  };

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-md border bg-card p-6 text-card-foreground transition',
        plan.highlighted
          ? 'border-primary shadow-elevated'
          : 'border-border shadow-card hover:shadow-elevated',
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
          {plan.badge}
        </span>
      )}

      <header className="border-b border-border pb-6">
        <h3 className="text-xl font-bold text-primary">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.audience}</p>
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold">{formatCop(plan.amountCop)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Pago unico, sin suscripcion.</p>
      </header>

      <ul className="my-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>

      {plan.sla && (
        <p className="mb-4 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground">
          {plan.sla}
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'mt-auto inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition',
            plan.highlighted
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border border-primary text-primary hover:bg-primary hover:text-primary-foreground',
          )}
        >
          Empezar análisis →
        </button>
      ) : (
        <form onSubmit={onSubmit} className="mt-auto space-y-3">
          <Field
            label="Correo de contacto"
            type="email"
            required
            autoComplete="email"
            value={form.customerEmail}
            onChange={(v) => setForm((prev) => ({ ...prev, customerEmail: v }))}
            placeholder="contacto@empresa.com"
          />
          <Field
            label="Nombre"
            value={form.customerName}
            onChange={(v) => setForm((prev) => ({ ...prev, customerName: v }))}
            placeholder="Nombre y apellido"
            autoComplete="name"
          />
          <Field
            label="Empresa"
            value={form.companyName}
            onChange={(v) => setForm((prev) => ({ ...prev, companyName: v }))}
            placeholder="Razon social"
            autoComplete="organization"
          />
          <Field
            label="NIT (opcional)"
            value={form.companyNit}
            onChange={(v) => setForm((prev) => ({ ...prev, companyNit: v }))}
            placeholder="900.123.456-7"
          />

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setOpen(false)}
              className="h-11 flex-1 rounded-md border border-input text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 flex-[1.5] items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Creando orden
                </>
              ) : (
                <>Pagar {formatCop(plan.amountCop)}</>
              )}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Al continuar aceptas que enviemos la confirmacion y el reporte al correo indicado.
          </p>
        </form>
      )}
    </article>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}

function Field({ label, value, onChange, type = 'text', required, placeholder, autoComplete }: FieldProps) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
