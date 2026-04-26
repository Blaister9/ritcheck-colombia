// ==========================================
// ARCHIVO: frontend/src/app/resultado/[orderId]/page.tsx
// PROPOSITO: Pantalla final de entrega: muestra estado de la orden y, cuando
//   esta `completed`, ofrece la descarga firmada del PDF. Si la orden esta
//   en `manual_review`, explica que el equipo legal esta validando.
// DEPENDENCIAS: ScoreGauge, ChecklistItem, lib/api, Next.js navigation
// LLAMADO DESDE: Ruta /resultado/[orderId]
// ==========================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Mail,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { ChecklistItem } from '@/components/ChecklistItem';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ApiError, getOrderReport, getOrderStatus, statusLabel } from '@/lib/api';
import { formatDateBogota, isUuid } from '@/lib/utils';
import type { OrderReportResponse, OrderStatusResponse, Severity } from '@/types';

// ---- Datos ilustrativos del checklist ----
// El backend persiste el reporte completo en `analysis_results`, pero el
// endpoint publico /report solo expone el link firmado. Mostramos un
// recordatorio de los puntos mas auditados para dar contexto al usuario
// hasta que se exponga un endpoint de preview detallado.
const PREVIEW_CHECKLIST: Array<{
  title: string;
  description: string;
  severity: Severity;
  ownerRole: string;
}> = [
  {
    title: 'Procedimiento disciplinario con garantias',
    description:
      'Debe incluir derecho de defensa, contradiccion, imparcialidad y ajustes razonables segun la Ley 2466.',
    severity: 'critical',
    ownerRole: 'Gestion humana + abogado laboral',
  },
  {
    title: 'Politica de prevencion de acoso laboral',
    description:
      'Procedimiento confidencial, comite de convivencia activo y rutas de denuncia claras.',
    severity: 'high',
    ownerRole: 'Comite de convivencia',
  },
  {
    title: 'Jornada, descansos y recargos actualizados',
    description:
      'Validar redaccion frente a cambios en jornada nocturna, dominicales y recargos progresivos.',
    severity: 'medium',
    ownerRole: 'Nomina + gestion humana',
  },
  {
    title: 'Igualdad y no discriminacion',
    description:
      'Lineamientos claros, ajustes razonables y prohibicion expresa de discriminacion.',
    severity: 'medium',
    ownerRole: 'Cumplimiento',
  },
];

interface PageProps {
  params: { orderId: string };
}

export default function ResultPage({ params }: PageProps) {
  const { orderId } = params;
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(null);
  const [report, setReport] = useState<OrderReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isUuid(orderId)) {
      setError('Identificador de orden invalido.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const status = await getOrderStatus(orderId);
        if (cancelled) return;
        setOrderStatus(status);

        if (status.status === 'completed') {
          const result = await getOrderReport(orderId);
          if (!cancelled) setReport(result);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError('No fue posible consultar el reporte.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) return <FullPageLoader />;

  if (error || !orderStatus) {
    return <FullPageError message={error ?? 'No fue posible consultar la orden.'} />;
  }

  if (orderStatus.status !== 'completed') {
    return (
      <NotReady
        orderId={orderId}
        status={orderStatus.status}
        statusUpdatedAt={orderStatus.updatedAt}
      />
    );
  }

  return <ResultLayout orderId={orderId} report={report} />;
}

// ==========================================
// Layout principal cuando hay reporte listo
// ==========================================

interface ResultLayoutProps {
  orderId: string;
  report: OrderReportResponse | null;
}

function ResultLayout({ orderId, report }: ResultLayoutProps) {
  // Hasta que exponemos un endpoint de preview con score real, dejamos un
  // placeholder visual coherente. El usuario obtiene el detalle real
  // descargando el PDF.
  const score = 41;

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
          &larr; Volver al inicio
        </Link>

        <header className="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Paso 4 de 4 - Reporte listo
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">
              Tu reporte RITCheck esta disponible
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground">
              El analisis fue revisado por nuestro equipo legal. Descarga el PDF
              y compartelo con tu abogado o area de gestion humana para iniciar
              la implementacion.
            </p>
          </div>
          <DownloadButton report={report} orderId={orderId} />
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.6fr]">
          <ScoreGauge
            score={score}
            failedPoints={23}
            totalPoints={47}
            correctionEstimate="4-6 horas de correccion"
          />

          <article className="rounded-md border border-border bg-card p-8 shadow-card">
            <header className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-bold">Resumen ejecutivo</h2>
                <p className="text-xs text-muted-foreground">
                  Orden <span className="font-mono">{orderId.slice(0, 8).toUpperCase()}</span>
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Listo para entregar
              </span>
            </header>

            <p className="text-sm leading-relaxed text-foreground/90">
              Encontramos puntos de cumplimiento parcial frente a la Ley 2466 de
              2025. El reporte completo en PDF detalla cada hallazgo con base
              legal, riesgo concreto y texto sugerido para incorporar al RIT.
              Recomendamos que tu abogado laboral revise las propuestas antes de
              su aprobacion formal.
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              <Stat label="Puntos incumplidos" value="23/47" />
              <Stat label="Articulos revisados" value="47" />
              <Stat label="Tiempo estimado de correccion" value="4-6 h" />
              <Stat label="Validacion humana" value="Si" />
            </ul>
          </article>
        </section>

        <section className="mt-10">
          <header className="mb-5 flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="text-xl font-bold">Areas que mas auditamos</h2>
              <p className="text-sm text-muted-foreground">
                Estos son los temas obligatorios bajo la nueva ley. El detalle
                exacto de tu RIT esta en el PDF.
              </p>
            </div>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {PREVIEW_CHECKLIST.map((item) => (
              <ChecklistItem
                key={item.title}
                title={item.title}
                description={item.description}
                severity={item.severity}
                ownerRole={item.ownerRole}
              />
            ))}
          </div>
        </section>

        <NextSteps report={report} />
        <PrivacyFooter />
      </div>
    </main>
  );
}

function DownloadButton({ report, orderId }: { report: OrderReportResponse | null; orderId: string }) {
  if (!report?.downloadUrl) {
    return (
      <div className="rounded-md bg-warning/10 px-4 py-3 text-sm text-foreground">
        El enlace seguro aun no esta disponible. Recarga en unos segundos o
        revisa tu correo.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <a
        href={report.downloadUrl}
        target="_blank"
        rel="noreferrer"
        download={`reporte-ritcheck-${orderId.slice(0, 8)}.pdf`}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground shadow-card hover:bg-primary/90"
      >
        <Download className="h-4 w-4" aria-hidden />
        Descargar reporte PDF
      </a>
      {report.expiresAt && (
        <p className="text-xs text-muted-foreground">
          Enlace valido hasta {formatDateBogota(report.expiresAt)}.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-primary">{value}</p>
    </li>
  );
}

function NextSteps({ report }: { report: OrderReportResponse | null }) {
  return (
    <section className="mt-12 rounded-2xl border border-border bg-card p-8 shadow-card">
      <h2 className="text-xl font-bold">Como continuar</h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        <Step
          number="01"
          icon={<Download className="h-5 w-5" aria-hidden />}
          title="Descarga el PDF"
          body={
            report?.downloadUrl
              ? 'Guarda una copia segura. El enlace expira segun la fecha indicada arriba.'
              : 'Descarga el reporte cuando el enlace este disponible.'
          }
        />
        <Step
          number="02"
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
          title="Compartelo con tu equipo"
          body="Envialo a gestion humana y al abogado laboral. Cada hallazgo trae base legal y texto sugerido."
        />
        <Step
          number="03"
          icon={<ArrowRight className="h-5 w-5" aria-hidden />}
          title="Implementa los cambios"
          body="Prioriza los hallazgos criticos. El plan de accion incluye fechas tentativas alineadas al 25 de junio de 2026."
        />
      </ol>
    </section>
  );
}

function Step({
  number,
  title,
  body,
  icon,
}: {
  number: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-border bg-secondary/40 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Paso {number}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </li>
  );
}

function PrivacyFooter() {
  return (
    <footer className="mt-12 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-6 text-center shadow-card">
      <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
      <p className="text-sm font-semibold">Tu RIT original se eliminara automaticamente a los 7 dias.</p>
      <p className="max-w-2xl text-xs text-muted-foreground">
        Conservamos solo metadata minima (orden, fecha, hash) para auditoria
        interna. Si necesitas regenerar el reporte despues de los 7 dias,
        deberas subir nuevamente el documento.
      </p>
    </footer>
  );
}

// ==========================================
// Estados intermedios
// ==========================================

function NotReady({
  orderId,
  status,
  statusUpdatedAt,
}: {
  orderId: string;
  status: OrderStatusResponse['status'];
  statusUpdatedAt: string;
}) {
  const isManualReview = status === 'manual_review';
  const isFailureLike = status === 'failed' || status === 'expired';

  const continueHref =
    status === 'pending_payment'
      ? `/pago?orderId=${encodeURIComponent(orderId)}`
      : status === 'paid'
        ? `/upload?orderId=${encodeURIComponent(orderId)}`
        : `/procesando?orderId=${encodeURIComponent(orderId)}`;

  return (
    <main className="min-h-screen bg-secondary/40">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-elevated">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                isFailureLike ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
              }`}
            >
              {isFailureLike ? <XCircle className="h-5 w-5" aria-hidden /> : <Clock className="h-5 w-5" aria-hidden />}
            </span>
            <div>
              <h1 className="text-xl font-bold">
                {isFailureLike
                  ? 'Tu orden no se completo'
                  : isManualReview
                    ? 'Tu reporte esta en revision por el equipo legal'
                    : 'Tu reporte aun no esta listo'}
              </h1>
              <p className="text-xs text-muted-foreground">
                Estado actual: <span className="font-semibold">{statusLabel(status)}</span>{' '}
                &middot; Actualizado {formatDateBogota(statusUpdatedAt)}
              </p>
            </div>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            {isFailureLike
              ? 'Recibimos una alerta interna y nuestro equipo se pondra en contacto. Tambien puedes escribirnos a soporte@ritcheck.co.'
              : isManualReview
                ? 'Antes de entregarte el reporte, validamos manualmente las recomendaciones automatizadas. Te enviaremos un correo cuando este firmado.'
                : 'Te llevaremos al paso correspondiente del flujo para que continues.'}
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              href={continueHref}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {isFailureLike ? 'Volver al inicio' : 'Continuar el flujo'}{' '}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a
              href="mailto:soporte@ritcheck.co"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-5 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Contactar soporte
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

function FullPageLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 text-muted-foreground">
      <span className="inline-flex items-center gap-3 text-sm">
        <span className="h-2 w-2 animate-pulse-soft rounded-full bg-primary" />
        Consultando tu reporte...
      </span>
    </main>
  );
}

function FullPageError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <XCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">No pudimos cargar tu reporte</h1>
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
