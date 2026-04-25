// ==========================================
// ARCHIVO: frontend/src/app/layout.tsx
// PROPOSITO: Layout raiz de Next.js con metadata, fuente Inter y estilos globales
// DEPENDENCIAS: React, Next.js, next/font, globals.css
// LLAMADO DESDE: App Router de Next.js
// ==========================================

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'RITCheck Colombia - Auditoria del Reglamento Interno de Trabajo',
    template: '%s - RITCheck Colombia',
  },
  description:
    'Analizamos tu Reglamento Interno de Trabajo frente a la Ley 2466 de 2025 y entregamos un reporte ejecutivo con hallazgos, riesgos y texto sugerido. Para empresas colombianas que necesitan cumplir antes del 25 de junio de 2026.',
  applicationName: 'RITCheck Colombia',
  authors: [{ name: 'RITCheck Colombia' }],
  keywords: [
    'Reglamento Interno de Trabajo',
    'RIT',
    'Ley 2466 de 2025',
    'cumplimiento laboral Colombia',
    'auditoria RIT',
    'Codigo Sustantivo del Trabajo',
  ],
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1a3458',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
