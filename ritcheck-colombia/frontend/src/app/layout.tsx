// ==========================================
// ARCHIVO: frontend/src/app/layout.tsx
// PROPOSITO: Layout raiz de Next.js con metadata, idioma y estilos globales
// DEPENDENCIAS: React, Next.js, globals.css
// LLAMADO DESDE: App Router de Next.js
// ==========================================

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RITCheck Colombia',
  description: 'Analisis de Reglamentos Internos de Trabajo frente a la Ley 2466 de 2025.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body>{children}</body>
    </html>
  );
}

