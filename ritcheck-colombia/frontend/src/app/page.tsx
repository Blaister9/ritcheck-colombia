// ==========================================
// ARCHIVO: frontend/src/app/page.tsx
// PROPOSITO: Landing principal orientada a conversion B2B para RITCheck
//   Colombia, con urgencia legal real, anclaje de precio y FAQ comercial.
// DEPENDENCIAS: PricingCard, lucide-react, lib/utils
// LLAMADO DESDE: Ruta `/` del App Router
// ==========================================

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSearch,
  FileText,
  Gavel,
  Lock,
  MessageCircle,
  Scale,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { PricingCard, type PricingPlan } from '@/components/PricingCard';
import { daysUntil, formatCop } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const COMPLIANCE_DEADLINE = '2026-06-25T23:59:59-05:00';
const WHATSAPP_DISPLAY = '+57 300 000 0000';
const WHATSAPP_URL = 'https://wa.me/573000000000';

const PLANS: PricingPlan[] = [
  {
    id: 'premium',
    name: 'PRO',
    audience: 'Empresas 100+ o multi-sede',
    amountCop: 399_000,
    badge: 'Recomendado para la mayoría de PYMEs',
    highlighted: true,
    sla: 'Incluye revision prioritaria y sesion de 30 min con abogado aliado.',
    features: [
      'Análisis Ley 2466 y artículos 104 al 115 del CST',
      'Score detallado y top de incumplimientos críticos',
      'Texto sugerido por cláusula listo para validar',
      'Análisis sectorial y procedimiento disciplinario',
      '2da revision post-correccion incluida',
      'Sesion de 30 min con abogado aliado',
    ],
  },
  {
    id: 'pro',
    name: 'Estándar',
    audience: 'PYMEs de 20 a 100 empleados',
    amountCop: 249_000,
    sla: 'Incluye segunda revision post-correccion.',
    features: [
      'Análisis Ley 2466 y artículos 104 al 115 del CST',
      'Score detallado y checklist priorizado',
      'Texto sugerido por cláusula',
      'Validacion de procedimiento disciplinario',
      '2da revision post-correccion incluida',
    ],
  },
  {
    id: 'basic',
    name: 'Básico',
    audience: 'PYMEs hasta 20 empleados',
    amountCop: 149_000,
    sla: 'Diagnostico inicial en menos de 10 minutos.',
    features: [
      'Análisis Ley 2466 y artículos 104 al 115 del CST',
      'Score de cumplimiento sobre 100',
      'Listado priorizado de incumplimientos',
      'Texto sugerido por cláusula',
      'Reporte PDF descargable',
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: '¿Esto reemplaza a un abogado laboralista?',
    a:
      'No. RITCheck identifica incumplimientos contra la Ley 2466 y el CST, y le entrega texto sugerido. La validación final y la firma del documento corregido la hace su abogado o asesor jurídico. Como ya tendrá el documento corregido, le tomará menos tiempo revisarlo.',
  },
  {
    q: '¿Qué pasa si mi RIT es muy viejo o muy raro?',
    a:
      'Mientras esté en formato PDF o Word legible, lo analizamos. Si su documento es escaneado de baja calidad, le pedimos volver a subirlo antes de procesar el reporte.',
  },
  {
    q: '¿Mis datos están seguros?',
    a:
      'Sí. Usamos conexión cifrada HTTPS, almacenamiento privado y enlaces firmados. El documento original se elimina automáticamente del servidor a los 7 días. No vendemos ni compartimos información con terceros.',
  },
  {
    q: '¿Y si después de corregir vuelvo a incumplir algo?',
    a:
      'El plan Estándar y el plan PRO incluyen una segunda revisión después de que corrija. Sube la versión nueva y le confirmamos si los puntos críticos quedaron cubiertos.',
  },
  {
    q: '¿Sirve para empresas con menos de 5 empleados?',
    a:
      'Si tiene menos de 5 trabajadores, el RIT no siempre es obligatorio. Pero si lo tiene publicado, debe estar actualizado. RITCheck le ayuda a identificar si ese documento lo está exponiendo innecesariamente.',
  },
  {
    q: '¿Por qué tan barato comparado con un abogado?',
    a:
      'Porque automatizamos la lectura cláusula por cláusula y entregamos un borrador estructurado. El abogado sigue siendo importante para validar, pero ya no tiene que partir de cero.',
  },
  {
    q: '¿Qué pasa si el inspector llega antes de que yo corrija?',
    a:
      'Si llega después del 25 de junio de 2026, la exposición aumenta. Si llega antes y usted demuestra que está en proceso de actualización, el reporte fechado puede servir como evidencia de buena fe. No es escudo total, pero ayuda.',
  },
  {
    q: '¿Puedo pagar con factura empresarial?',
    a:
      'Sí. Emitimos factura electrónica DIAN a nombre de su empresa con NIT. Puede pagar por PSE, Nequi, Daviplata o tarjeta según disponibilidad de la pasarela.',
  },
];

export default function LandingPage() {
  const days = daysUntil(COMPLIANCE_DEADLINE);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <UrgencyBanner days={days} />
      <SiteHeader />
      <Hero days={days} />
      <ProblemSection />
      <SolutionSection />
      <PricingSection />
      <ReportExample />
      <TrustSection />
      <FAQ />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

function UrgencyBanner({ days }: { days: number }) {
  return (
    <div className="sticky top-0 z-50 bg-accent text-accent-foreground shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-bold md:text-sm">
        <span>
          ⚠ Deadline Ley 2466 — 25 de junio de 2026 · Faltan {days} días
        </span>
        <span className="hidden font-medium md:inline">
          · Después de esta fecha, todo RIT desactualizado es prueba documental en su contra.
        </span>
      </div>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-base font-bold">
            RITCheck <span className="font-medium text-muted-foreground">Colombia</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#problema" className="hover:text-primary">Riesgo</a>
          <a href="#solucion" className="hover:text-primary">Solucion</a>
          <a href="#planes" className="hover:text-primary">Precios</a>
          <a href="#faq" className="hover:text-primary">FAQ</a>
        </nav>
        <a
          href="#planes"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Analizar RIT
        </a>
      </div>
    </header>
  );
}

function Hero({ days }: { days: number }) {
  return (
    <section className="border-b border-border bg-secondary">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 px-3 py-1 text-sm font-bold text-primary">
            <Scale className="h-4 w-4" aria-hidden />
            Ley 2466 de 2025 · Art. 8
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl">
            Su Reglamento Interno está desactualizado. Multas hasta $8.754M.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Analizamos su Reglamento Interno de Trabajo contra los 47 puntos de la Ley 2466 de 2025 en 7 minutos. Le entregamos el reporte de incumplimientos y el texto exacto que debe corregir. Sin abogado. Por una décima parte del costo.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#planes"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground shadow-card hover:bg-primary/90"
            >
              Analizar mi RIT ahora — $149.000
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#reporte-ejemplo"
              className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-6 text-base font-semibold text-foreground hover:bg-muted"
            >
              Ver ejemplo de reporte
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Resultado en menos de 10 minutos · Pago seguro PSE/tarjeta · Si no encontramos al menos 5 incumplimientos, le devolvemos el 100%.
          </p>
        </div>

        <div className="rounded-md border border-border bg-background p-5 shadow-elevated">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-sm font-bold text-primary">Reporte RITCheck</p>
              <p className="text-xs text-muted-foreground">Vista de ejemplo con datos tachados</p>
            </div>
            <span className="rounded-md bg-accent/20 px-3 py-1 text-sm font-bold text-primary">
              Faltan {days} días
            </span>
          </div>
          <div className="mt-5">
            <p className="text-sm font-semibold">Score de cumplimiento Ley 2466</p>
            <div className="mt-3 h-4 rounded-sm bg-muted">
              <div className="h-4 rounded-sm bg-accent" style={{ width: '41%' }} />
            </div>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-4xl font-extrabold text-primary">41/100</p>
            <p className="text-sm text-muted-foreground">23 de 47 puntos incumplidos</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[
              'Procedimiento disciplinario incompleto',
              'Jornada nocturna sin actualizacion',
              'Ruta de acoso laboral insuficiente',
            ].map((item) => (
              <div key={item} className="rounded-md border border-border bg-secondary p-3">
                <p className="text-sm font-semibold">{item}</p>
                <div className="mt-2 h-2 w-3/4 rounded-sm bg-muted-foreground/20" />
                <div className="mt-2 h-2 w-1/2 rounded-sm bg-muted-foreground/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const pains = [
    {
      icon: <Gavel className="h-5 w-5" aria-hidden />,
      title: 'Multas de 1 a 5.000 SMMLV',
      body: 'Entre $1,75 millones y $8.754 millones, segun el tamano de su empresa y la gravedad. La inspeccion laboral es discrecional.',
    },
    {
      icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
      title: 'Sanciones disciplinarias anuladas',
      body: 'Si despidio a alguien aplicando el RIT viejo, esa sancion puede declararse nula. Reintegro, salarios dejados de percibir y costas.',
    },
    {
      icon: <Timer className="h-5 w-5" aria-hidden />,
      title: 'Reclamaciones por horas extra mal liquidadas',
      body: 'El nuevo limite nocturno cambia el recargo. Cualquier empleado puede reclamar diferencias retroactivas si el RIT contradice la ley vigente.',
    },
  ];

  return (
    <section id="problema" className="mx-auto max-w-6xl px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase text-primary">El problema</p>
        <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
          ¿Su RIT sigue hablando de jornadas de 48 horas? Ya es ilegal.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          El 25 de junio de 2025, el Presidente sanciono la Ley 2466. Cambio 47 puntos del Codigo Sustantivo del Trabajo. Si su Reglamento Interno de Trabajo no fue actualizado despues de esa fecha, hoy contradice la ley vigente. Y la ley le da hasta el 25 de junio de 2026 para arreglarlo.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {pains.map((pain) => (
          <article key={pain.title} className="rounded-md border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-accent/20 text-primary">
              {pain.icon}
            </div>
            <h3 className="text-lg font-bold">{pain.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pain.body}</p>
          </article>
        ))}
      </div>
      <a href="#planes" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
        Saber cuánto está expuesta mi empresa
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}

function SolutionSection() {
  const steps = [
    {
      title: 'Suba su RIT en PDF o Word.',
      body: 'Conexión cifrada. El documento original se elimina automáticamente a los 7 días.',
    },
    {
      title: 'Reciba el reporte en menos de 10 minutos.',
      body: 'Score de 0 a 100, lista priorizada de incumplimientos y citas del articulo de ley aplicable.',
    },
    {
      title: 'Use el texto sugerido para corregir.',
      body: 'Cada incumplimiento incluye redaccion modelo lista para que su contador o abogado la valide rapidamente.',
    },
  ];

  return (
    <section id="solucion" className="border-y border-border bg-secondary py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-[0.95fr_1.05fr] md:items-start">
          <div>
            <p className="text-sm font-bold uppercase text-primary">La solucion</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
              Suba su RIT. En 7 minutos sabe que corregir.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              RITCheck analiza su documento contra los 47 puntos de la Ley 2466 y los articulos 104 al 115 del CST. Le entregamos un reporte con score de cumplimiento, lista exacta de incumplimientos y el texto sugerido para cada clausula que debe corregir.
            </p>
            <a
              href="#planes"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Analizar mi RIT - $149.000
            </a>
          </div>
          <ol className="grid gap-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-md border border-border bg-background p-5 shadow-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-8 rounded-md border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
          RITCheck no presta servicios de asesoría legal. Es una herramienta de análisis automatizado de cumplimiento basada en el texto de la Ley 2466 de 2025 y el Código Sustantivo del Trabajo. La validación final corresponde a un profesional del derecho.
        </p>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="planes" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 max-w-3xl">
        <p className="text-sm font-bold uppercase text-primary">Precios</p>
        <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
          Un análisis cuesta menos que una hora con un abogado laboralista.
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Compare. Un abogado laboralista cobra entre $500.000 y $3.000.000 por revisar y actualizar un RIT. Tarda entre 2 y 4 semanas. RITCheck lo hace en menos de 10 minutos.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-4 lg:items-stretch">
        <AnchorPriceCard />
        {PLANS.map((plan) => (
          <PricingCard key={plan.id} plan={plan} />
        ))}
      </div>

      <p className="mt-8 rounded-md bg-secondary p-4 text-center text-sm text-muted-foreground">
        Pago seguro via PSE, Nequi, Daviplata o tarjeta · Factura electronica DIAN · Garantia: si no encontramos al menos 5 incumplimientos, devolvemos el 100%.
      </p>
    </section>
  );
}

function AnchorPriceCard() {
  return (
    <article className="rounded-md border border-border bg-secondary p-6 shadow-card">
      <p className="text-sm font-bold uppercase text-primary">Referencia del mercado</p>
      <h3 className="mt-3 text-xl font-bold">Abogado laboralista</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Revision manual clausula por clausula, agenda y tiempos de entrega variables.
      </p>
      <div className="mt-6">
        <p className="text-3xl font-extrabold text-primary">$500.000</p>
        <p className="text-sm font-semibold text-muted-foreground">a $3.000.000</p>
      </div>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="font-bold text-primary">-</span>
          2 a 4 semanas de espera.
        </li>
        <li className="flex gap-2">
          <span className="font-bold text-primary">-</span>
          Requiere reuniones y revision manual.
        </li>
        <li className="flex gap-2">
          <span className="font-bold text-primary">-</span>
          Sigue siendo necesario para validacion final.
        </li>
      </ul>
    </article>
  );
}

function ReportExample() {
  return (
    <section id="reporte-ejemplo" className="border-y border-border bg-secondary py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-primary">Entregable documentable</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">
            Un PDF que puede mostrarle a su contador, gerente o abogado.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            El objetivo no es asustarlo con un numero. Es darle un punto de partida medible, los incumplimientos criticos y el texto sugerido para corregir.
          </p>
        </div>
        <div className="rounded-md border border-border bg-background p-5 shadow-elevated">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-sm font-bold text-primary">Score de cumplimiento Ley 2466</p>
              <p className="text-xs text-muted-foreground">Ejemplo anonimo de reporte</p>
            </div>
            <BadgeCheck className="h-6 w-6 text-success" aria-hidden />
          </div>
          <div className="mt-5">
            <div className="h-4 rounded-sm bg-muted">
              <div className="h-4 rounded-sm bg-accent" style={{ width: '41%' }} />
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
              <p className="text-4xl font-extrabold text-primary">41/100</p>
              <p className="text-sm font-semibold text-muted-foreground">23 de 47 puntos incumplidos</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Estimamos 4-6 horas de correccion con el texto sugerido en el reporte.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {['Art. 108 CST - Contenido minimo del RIT', 'Ley 2466 Art. 8 - Ajustes obligatorios', 'Decreto 472 de 2015 - Riesgo de sancion'].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md border border-border bg-secondary p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  const items = [
    {
      icon: <Building2 className="h-5 w-5" aria-hidden />,
      title: 'Pensado para PYMEs colombianas',
      body: 'Lenguaje claro, precios en COP, factura electronica DIAN y pago por medios que ya usa su empresa.',
    },
    {
      icon: <CreditCard className="h-5 w-5" aria-hidden />,
      title: 'Pago con PSE, Nequi, Daviplata o tarjeta',
      body: 'La transaccion la procesa la pasarela. RITCheck no almacena datos financieros sensibles.',
    },
    {
      icon: <Lock className="h-5 w-5" aria-hidden />,
      title: 'Documento privado',
      body: 'Su RIT se procesa para generar el reporte y el archivo original se elimina automáticamente a los 7 días.',
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-5 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.title} className="rounded-md border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              {item.icon}
            </div>
            <h3 className="font-bold">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="border-y border-border bg-secondary py-16">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase text-primary">FAQ</p>
          <h2 className="mt-2 text-3xl font-bold">Lo que pregunta todo empresario antes de comprar.</h2>
        </div>
        <div className="divide-y divide-border rounded-md border border-border bg-background shadow-card">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <span className="font-semibold">{item.q}</span>
                <span className="text-2xl font-bold text-primary transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 text-center">
      <h2 className="text-3xl font-extrabold leading-tight md:text-4xl">
        El 25 de junio llega. Su RIT no se va a actualizar solo.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
        7 minutos. {formatCop(149_000)}. Sabe exactamente que tiene que arreglar antes del deadline.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href="#planes"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-7 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Analizar mi RIT ahora
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
        <a
          href={WHATSAPP_URL}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-background px-7 text-base font-semibold text-foreground hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          WhatsApp {WHATSAPP_DISPLAY}
        </a>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Si después del análisis no encuentra valor, le devolvemos los $149.000. Sin formularios, sin discusiones.
      </p>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-primary py-10 text-sm text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
        <div>
          <p className="font-bold">RITCheck Colombia</p>
          <p className="mt-2 text-primary-foreground/80">
            Análisis automatizado de cumplimiento para Reglamentos Internos de Trabajo frente a la Ley 2466 de 2025.
          </p>
        </div>
        <div>
          <p className="font-bold">Confianza</p>
          <ul className="mt-2 space-y-1 text-primary-foreground/80">
            <li>Factura electronica DIAN</li>
            <li>Pago seguro por pasarela colombiana</li>
            <li>Documento original eliminado a los 7 días</li>
          </ul>
        </div>
        <div>
          <p className="font-bold">Contacto</p>
          <ul className="mt-2 space-y-1 text-primary-foreground/80">
            <li>
              <a href={WHATSAPP_URL} className="hover:text-white">WhatsApp {WHATSAPP_DISPLAY}</a>
            </li>
            <li>
              <a href="mailto:soporte@ritcheck.co" className="hover:text-white">soporte@ritcheck.co</a>
            </li>
            <li>Bogota, Colombia</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl border-t border-primary-foreground/20 px-6 pt-6 text-xs text-primary-foreground/70">
        RITCheck no presta asesoría legal. La validación final corresponde a un profesional del derecho.
      </div>
    </footer>
  );
}
