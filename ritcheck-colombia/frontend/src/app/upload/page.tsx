// ==========================================
// ARCHIVO: frontend/src/app/upload/page.tsx
// PROPOSITO: Pantalla de carga del RIT despues de pago confirmado.
//   Verifica que la orden este `paid` o `uploaded` antes de mostrar el dropzone.
// DEPENDENCIAS: UploadZone, lib/api, Next.js navigation
// LLAMADO DESDE: Ruta /upload?orderId=...
// ==========================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, FileText, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { ApiError, getOrderStatus, statusLabel } from '@/lib/api';
import { isUuid } from '@/lib/utils';
import type { OrderStatusResponse } from '@/types';

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !isUuid(orderId)) {
      setError('Identificador de orden invalido. Vuelve a la pagina principal.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const status = await getOrderStatus(orderId);
        if (cancelled) return;
        setOrderStatus(status);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('No fue posible consultar la orden.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const onUploaded = () => {
    if (orderId) router.push(`/procesando?orderId=${encodeURIComponent(orderId)}`);
  };

  // ---- Render ----

  if (loading) return <FullPageLoader />;

  if (error || !orderId) {
    return (
      <ErrorScreen
        title="No pudimos cargar tu orden"
        message={error ?? 'Vuelve al inicio y selecciona un plan.'}
      />
    );
  }

  // Solo permitimos uploads cuando la orden esta `paid` o `uploaded` (reintento).
  if (!orderStatus || !['paid', 'uploaded'].includes(orderStatus.status)) {
    return (
      <NotReadyScreen orderId={orderId} status={orderStatus?.status} />
    );
  }

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Volver al inicio
        </Link>

        <header className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Paso 2 de 4 - Carga segura
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Sube tu Reglamento Interno de Trabajo
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Aceptamos PDF o DOCX con texto seleccionable. Si tu RIT esta
            escaneado, generalo nuevamente desde Word u otro editor antes de
            subirlo. Maximo 15 MB.
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <UploadZone orderId={orderId} onUploaded={onUploaded} />
          <SideTips />
        </section>
      </div>
    </main>
  );
}

function SideTips() {
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">Que documento debo subir</h2>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Tu RIT vigente, completo y firmado.</li>
          <li>Anexos del RIT si aplican (politicas internas).</li>
          <li>Texto seleccionable, no escaneado.</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="text-base font-semibold">Privacidad por diseno</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu archivo viaja cifrado y se borra automaticamente a los 7 dias del
          analisis. No usamos tu RIT para entrenar modelos ni se comparte fuera
          del equipo legal.
        </p>
      </div>
    </aside>
  );
}

function FullPageLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando tu orden...
      </div>
    </main>
  );
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <XCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">{title}</h1>
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

function NotReadyScreen({
  orderId,
  status,
}: {
  orderId: string;
  status?: OrderStatusResponse['status'];
}) {
  // Si ya esta procesando o despues, mandamos al usuario al flujo correspondiente.
  const next =
    status === 'processing' || status === 'manual_review'
      ? `/procesando?orderId=${encodeURIComponent(orderId)}`
      : status === 'completed'
        ? `/resultado/${encodeURIComponent(orderId)}`
        : `/pago?orderId=${encodeURIComponent(orderId)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <h1 className="text-xl font-bold">La orden aun no esta lista para recibir documentos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Estado actual: <span className="font-semibold text-foreground">{statusLabel(status ?? 'pending_payment')}</span>.
          Avanza desde la pantalla correspondiente.
        </p>
        <Link
          href={next}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Continuar <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </main>
  );
}
