// ==========================================
// ARCHIVO: frontend/src/app/api/health/route.ts
// PROPOSITO: Healthcheck ligero para Vercel y monitoreo
// DEPENDENCIAS: NextResponse
// LLAMADO DESDE: Monitores externos
// ==========================================

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'ritcheck-frontend',
    timestamp: new Date().toISOString(),
  });
}

