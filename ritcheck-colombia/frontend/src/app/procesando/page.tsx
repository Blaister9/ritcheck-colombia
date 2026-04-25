// ==========================================
// ARCHIVO: frontend/src/app/procesando/page.tsx
// PROPOSITO: Pantalla de espera con polling cada 5 s al endpoint
//   GET /orders/:id/status. Muestra timeline animado y redirige a
//   /resultado cuando el reporte esta listo.
// DEPENDENCIAS: OrderStatusTimeline, lib/api, Next.js navigation
// LLAMADO DESDE: Ruta /procesando?orderId=...
// ==========================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { OrderStatusTimeline } from '@/components/OrderStatus';
import { ApiError, getOrderStatus, statusLabel } from '@/lib/api';
import { isUuid, timeAgo } from '@/lib/utils';
import type { OrderStatusResponse } from '@/types';

const POLL_MS = 5_000;

export default function ProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [status, setStatus] = useState<OrderStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!orderId || !isUuid(orderId)) {
      setError('Falta o es invalido el identificador de la orden.');
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const fetchOnce = async () => {
      try {
        const result = await getOrderStatus(orderId);
        if (cancelled) return;
        setStatus(result);
        setLastFetchedAt(new Date());
        setError(null);

        if (result.status === 'completed') {
          router.replace(`/resultado/${encodeURIComponent(orderId)}`);
          return;
        }
        if (result.status === 'failed' || result.status === 'expired') {
          // Dejamos de hacer polling; mostramos estado final.
          return;
        }
        timer = window.setTimeout(fetchOnce, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('No fue posible consultar el estado.');
        }
        // Reintentamos despues de un pequeno backoff.
        timer = window.setTimeout(fetchOnce, POLL_MS * 2);
      }
    };

    fetchOnce();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId, router]);

  if (!orderId || !isUuid(orderId)) {
    return <FullPageError message="Identificador de orden invalido. Vuelve al inicio y selecciona un plan." />;
  }

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Volver al inicio
        </Link>

        <header className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Paso 3 de 4 - Analisis
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Estamos analizando tu Reglamento Interno
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            El motor compara articulo por articulo contra la Ley 2466 de 2025 y
            el Codigo Sustantivo del Trabajo. Este proceso suele tardar entre 5
            y 20 minutos. Puedes cerrar esta ventana, te enviaremos un correo
            cuando el reporte este listo.
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <header className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Estado actual
                </p>
                <p className="mt-1 text-lg font-semibold text-primary">
                  {status ? statusLabel(status.status) : 'Consultando...'}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                {lastFetchedAt ? timeAgo(lastFetchedAt.toISOString()) : 'consultando'}
              </span>
            </header>

            {error && (
              <p
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-md bg-warning/10 px-4 py-3 text-sm text-foreground"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                {error} Reintentaremos automaticamente en unos segundos.
              </p>
            )}

            {status?.status === 'failed' && <FailureBlock orderId={orderId} />}
            {status?.status === 'expired' && <ExpiredBlock />}
            {status && status.status !== 'failed' && status.status !== 'expired' && (
              <OrderStatusTimeline status={status.status} />
            )}
          </div>

          <SideInfo orderId={orderId} />
        </section>
      </div>
    </main>
  );
}

function SideInfo({ orderId }: { orderId: string }) {
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <Mail className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">Te avisaremos por correo</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cuando termine el analisis enviaremos un correo con un enlace seguro
          para descargar el reporte. No necesitas dejar esta ventana abierta.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">Tu documento esta seguro</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          El RIT original viaja cifrado, nunca se loguea su contenido y se
          elimina automaticamente a los 7 dias.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">Verificacion humana</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Antes de entregarte el reporte, nuestro equipo legal revisa las
          recomendaciones para evitar respuestas automaticas sin contexto.
        </p>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Orden: <span className="font-mono">{orderId.slice(0, 8).toUpperCase()}</span>
      </p>
    </aside>
  );
}

function FailureBlock({ orderId }: { orderId: string }) {
  return (
    <div className="rounded-md bg-destructive/10 p-5">
      <h2 className="text-base font-semibold text-destructive">Algo salio mal con tu orden</h2>
      <p className="mt-2 text-sm text-foreground">
        Detectamos un problema durante el procesamiento. Nuestro equipo recibio
        una alerta automatica y te contactaremos en menos de 24 horas habiles.
        Si necesitas ayuda inmediata, escribenos a{' '}
        <a href="mailto:soporte@ritcheck.co" className="font-semibold text-destructive underline">
          soporte@ritcheck.co
        </a>{' '}
        citando la orden <span className="font-mono">{orderId.slice(0, 8).toUpperCase()}</span>.
      </p>
    </div>
  );
}

function ExpiredBlock() {
  return (
    <div className="rounded-md bg-warning/10 p-5">
      <h2 className="text-base font-semibold">Tu orden expiro</h2>
      <p className="mt-2 text-sm text-foreground">
        Si crees que es un error, contactanos en{' '}
        <a href="mailto:soporte@ritcheck.co" className="font-semibold underline">
          soporte@ritcheck.co
        </a>
        . Tambien puedes crear una orden nueva desde la pagina principal.
      </p>
    </div>
  );
}

function FullPageError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <AlertTriangle className="mx-auto h-8 w-8 text-warning" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">No pudimos cargar el estado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

