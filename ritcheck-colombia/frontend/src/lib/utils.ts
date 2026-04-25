// ==========================================
// ARCHIVO: frontend/src/lib/utils.ts
// PROPOSITO: Utilidades compartidas de frontend
// DEPENDENCIAS: clsx, tailwind-merge
// LLAMADO DESDE: Componentes UI y paginas
// ==========================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// TODO: agregar formatter de fechas usando America/Bogota.

