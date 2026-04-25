// ==========================================
// ARCHIVO: frontend/src/lib/utils.ts
// PROPOSITO: Utilidades compartidas de frontend (clases CSS, formatos COP/fechas)
// DEPENDENCIAS: clsx, tailwind-merge
// LLAMADO DESDE: Componentes UI y paginas
// ==========================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina clases Tailwind sin duplicar utilidades antagonicas. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea pesos colombianos sin decimales (ej: $249.000). */
export function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formatea una fecha ISO en hora colombiana, formato largo. */
export function formatDateBogota(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Devuelve "hace X minutos" / "hace X horas" - util en pantalla de estado. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return '';
  const diffSec = Math.max(1, Math.round((now.getTime() - target) / 1000));
  if (diffSec < 60) return `hace ${diffSec} s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `hace ${diffD} dias`;
}

/** Cuenta regresiva en dias hasta una fecha objetivo (Ley 2466). */
export function daysUntil(targetIso: string, from: Date = new Date()): number {
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.ceil((target - from.getTime()) / (24 * 60 * 60 * 1000)));
}

/** UUID v4 simple para validar input antes de llamar al backend. */
export function isUuid(value: string | undefined | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
