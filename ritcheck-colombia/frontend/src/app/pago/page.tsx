// ==========================================
// ARCHIVO: frontend/src/app/pago/page.tsx
// PROPOSITO: Pantalla de confirmacion de orden y redireccion a Bold Checkout.
//   Tras detectar pago confirmado (status `paid`), redirige a /upload.
// DEPENDENCIAS: React, Next.js navigation, lib/api, lib/utils
// LLAMADO DESDE: Ruta /pago?orderId=...
// ==========================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { ApiError, getOrderStatus, statusLabel } from '@/lib/api';
import { formatCop, isUuid } from '@/lib/utils';
import type { OrderStatusResponse } from '@/types';

interface OrderViewModel {
  orderId: string;
  status: OrderStatusResponse['status'];
  amountCop?: number;
  checkoutUrl?: string;
}

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Cargar la orden inicial. La info del checkout (amount + checkoutUrl)
  //    no viene en /status, asi que la guardamos en sessionStorage al crearla.
  useEffect(() => {
    if (!orderId) {
      setError('Falta el identificador de la orden. Vuelve a la pagina principal y selecciona un plan.');
      setLoading(false);
      return;
    }
    if (!isUuid(orderId)) {
      setError('Identificador de orden invalido.');
      setLoading(false);
      return;
    }

    const stored = readStoredCheckout(orderId);
    let cancelled = false;

    (async () => {
      try {
        const status = await getOrderStatus(orderId);
        if (cancelled) return;
        setOrder({
          orderId,
          status: status.status,
          amountCop: stored?.amountCop,
          checkoutUrl: stored?.checkoutUrl,
        });
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

  // 2. Polling cada 4 segundos para detectar transicion `paid` y redirigir a /upload.
  useEffect(() => {
    if (!order || !orderId) return;
    if (['paid', 'uploaded', 'processing', 'completed', 'manual_review'].includes(order.status)) {
      router.replace(`/upload?orderId=${encodeURIComponent(orderId)}`);
      return;
    }
    if (order.status !== 'pending_payment') return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const status = await getOrderStatus(orderId);
        if (cancelled) return;
        setOrder((prev) => (prev ? { ...prev, status: status.status } : prev));
        if (
          ['paid', 'uploaded', 'processing', 'completed', 'manual_review'].includes(status.status)
        ) {
          router.replace(`/upload?orderId=${encodeURIComponent(orderId)}`);
        }
        if (status.status === 'failed' || status.status === 'expired') {
          window.clearInterval(interval);
        }
      } catch {
        // Silencioso: el status seguira reintentando.
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [order, orderId, router]);

  // ---- Render ----

  if (loading) {
    return <FullPageState icon={<Loader2 className="h-6 w-6 animate-spin" aria-hidden />} title="Preparando tu orden" />;
  }

  if (error || !order || !orderId) {
    return (
      <FullPageState
        icon={<XCircle className="h-6 w-6 text-destructive" aria-hidden />}
        title="No pudimos cargar tu orden"
        body={error ?? 'Vuelve a la pagina principal y crea una orden nueva.'}
        cta={{ href: '/', label: 'Volver al inicio' }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-secondary/40 py-16">
      <div className="mx-auto max-w-2xl px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Volver al inicio
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-card p-8 shadow-elevated">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Wallet className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Confirma tu pago con Bold</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tu orden esta lista. Te redirigiremos al portal seguro de Bold
                Colombia. Los datos de tu tarjeta nunca pasan por nuestros
                servidores.
              </p>
            </div>
          </div>

          <dl className="mt-8 space-y-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
            <Row label="Numero de orden" value={order.orderId.slice(0, 8).toUpperCase()} />
            {typeof order.amountCop === 'number' && (
              <Row label="Total a pagar" value={`${formatCop(order.amountCop)} COP`} bold />
            )}
            <Row label="Estado actual" value={statusLabel(order.status)} />
          </dl>

          {order.status === 'pending_payment' ? (
            <PendingActions checkoutUrl={order.checkoutUrl} orderId={order.orderId} />
          ) : (
            <PostPaymentNotice orderId={order.orderId} status={order.status} />
          )}
        </div>

        <SecurityFooter />
      </div>
    </main>
  );
}

function PendingActions({ checkoutUrl, orderId }: { checkoutUrl?: string; orderId: string }) {
  if (!checkoutUrl) {
    return (
      <div className="mt-8 rounded-md bg-warning/10 px-4 py-3 text-sm text-foreground">
        No encontramos el link de pago. Recarga la pagina o crea la orden nuevamente desde el inicio.
        <div className="mt-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            Volver
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-3">
      <a
        href={checkoutUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Pagar con Bold <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
      <p className="text-center text-xs text-muted-foreground">
        Aceptamos tarjetas debito/credito, PSE y Nequi. Esta pantalla se
        actualiza automaticamente cuando recibimos el pago.
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Orden: <span className="font-mono">{orderId}</span>
      </p>
    </div>
  );
}

function PostPaymentNotice({ orderId, status }: { orderId: string; status: OrderStatusResponse['status'] }) {
  const isFailure = status === 'failed' || status === 'expired';
  return (
    <div className="mt-8 space-y-3">
      <div
        className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm ${
          isFailure ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
        }`}
      >
        {isFailure ? (
          <XCircle className="h-5 w-5" aria-hidden />
        ) : (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        )}
        <span className="font-semibold">
          {isFailure
            ? 'Tu orden expiro o no pudo procesarse.'
            : 'Pago confirmado. Te llevamos a la pantalla de carga del RIT.'}
        </span>
      </div>
      {!isFailure && (
        <Link
          href={`/upload?orderId=${encodeURIComponent(orderId)}`}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Continuar a subir documento <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? 'font-mono text-base font-bold text-primary' : 'font-mono'}>{value}</dd>
    </div>
  );
}

function SecurityFooter() {
  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      Pago procesado por Bold Colombia. Cumplimiento PCI-DSS.
    </p>
  );
}

function FullPageState({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto mb-3 inline-flex">{icon}</div>
        <h1 className="text-xl font-bold">{title}</h1>
        {body && <p className="mt-2 max-w-md text-sm text-muted-foreground">{body}</p>}
        {cta && (
          <Link
            href={cta.href}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </main>
  );
}

// ---- Storage helpers ----

interface StoredCheckout {
  amountCop?: number;
  checkoutUrl?: string;
}

function readStoredCheckout(orderId: string): StoredCheckout | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(`ritcheck:order:${orderId}`);
    if (raw) return JSON.parse(raw) as StoredCheckout;
  } catch {
    // ignore
  }
  return undefined;
}
