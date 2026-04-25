// ==========================================
// ARCHIVO: frontend/src/app/api/webhook/bold/route.ts
// PROPOSITO: Proxy opcional de webhooks Bold cuando Vercel reciba eventos
// DEPENDENCIAS: NextRequest, backend API
// LLAMADO DESDE: Bold Webhooks
// ==========================================

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-bold-signature');

  // TODO: reenviar rawBody y signature al backend sin mutar payload.
  // TODO: si se usa solo backend en Railway, eliminar esta ruta de Vercel para reducir superficie.
  return NextResponse.json({
    received: true,
    proxied: false,
    signaturePresent: Boolean(signature),
    rawBodyLength: rawBody.length,
  });
}

