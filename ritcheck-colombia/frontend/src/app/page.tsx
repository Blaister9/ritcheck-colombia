// ==========================================
// ARCHIVO: frontend/src/app/page.tsx
// PROPOSITO: Landing institucional con propuesta de valor, planes en COP,
//   detalle de entregables y contador hasta el 25 de junio de 2026.
// DEPENDENCIAS: PricingCard, lucide-react, lib/utils
// LLAMADO DESDE: Ruta `/` del App Router
// ==========================================

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  FileSearch,
  Gavel,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import { PricingCard, type PricingPlan } from '@/components/PricingCard';
import { daysUntil } from '@/lib/utils';

const COMPLIANCE_DEADLINE = '2026-06-25T23:59:59-05:00';

const PLANS: PricingPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    audience: 'PYMEs hasta 30 colaboradores',
    amountCop: 149_000,
    sla: 'Entrega en 24 horas habiles.',
    features: [
      'Score de cumplimiento sobre 100 puntos',
      'Listado priorizado de hallazgos por severidad',
      'Identificacion de articulos faltantes segun Ley 2466',
      'Reporte PDF descargable y enlace privado seguro',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'Empresas medianas con area de gestion humana',
    amountCop: 249_000,
    badge: 'Mas elegido',
    highlighted: true,
    sla: 'Entrega en 12 horas habiles.',
    features: [
      'Todo lo del plan Basic',
      'Texto juridico sugerido listo para insertar en tu RIT',
      'Plan de accion con fechas y responsables sugeridos',
      'Checklist accionable por severidad',
      'Revision humana del equipo legal antes de la entrega',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    audience: 'Empresas con multiples sedes o requerimientos especiales',
    amountCop: 399_000,
    sla: 'Entrega prioritaria en 6 horas habiles.',
    features: [
      'Todo lo del plan Pro',
      'Sesion de 30 minutos con abogado laboral colombiano',
      'Recomendaciones de implementacion por sede',
      'Versionamiento del reporte ante cambios normativos posteriores',
      'Soporte prioritario por correo durante 30 dias',
    ],
  },
];

export default function LandingPage() {
  const days = daysUntil(COMPLIANCE_DEADLINE);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <ComplianceBanner days={days} />

      <Hero days={days} />

      <Pricing />

      <Deliverables />

      <Process />

      <TrustSection />

      <FAQ />

      <FinalCTA />

      <SiteFooter />
    </main>
  );
}

// ==========================================
// Header / banner / hero
// ==========================================

function SiteHeader() {
  return (
    <header className="border-b border-border/80 bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ScrollText className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-base font-bold tracking-tight">
            RITCheck <span className="font-medium text-muted-foreground">Colombia</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#planes" className="hover:text-primary">Planes</a>
          <a href="#entregable" className="hover:text-primary">Que recibes</a>
          <a href="#proceso" className="hover:text-primary">Como funciona</a>
          <a href="#faq" className="hover:text-primary">Preguntas</a>
        </nav>
        <a
          href="#planes"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Empezar
        </a>
      </div>
    </header>
  );
}

function ComplianceBanner({ days }: { days: number }) {
  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-2 text-center text-xs font-medium md:flex-row md:text-sm">
        <p className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Ley 2466 de 2025: las empresas tienen plazo hasta el 25 de junio de 2026 para actualizar el RIT.
        </p>
        <p className="font-semibold">
          Faltan <span className="rounded bg-primary-foreground/15 px-1.5 py-0.5">{days}</span> dias.
        </p>
      </div>
    </div>
  );
}

function Hero({ days }: { days: number }) {
  return (
    <section className="bg-secondary/50">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
        <div className="animate-fade-in-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Gavel className="h-3.5 w-3.5" aria-hidden />
            Auditoria juridica con respaldo legal
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Asegura que tu Reglamento Interno de Trabajo cumpla la
            <span className="text-primary"> Ley 2466 de 2025.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Analizamos tu RIT articulo por articulo frente al Codigo Sustantivo del
            Trabajo y la nueva ley. En menos de 24 horas recibes un reporte ejecutivo
            con hallazgos, riesgos y texto sugerido listo para que tu abogado lo
            valide. Sin reuniones, sin formularios infinitos.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#planes"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground shadow-card hover:bg-primary/90"
            >
              Ver planes y precios
            </a>
            <a
              href="#proceso"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-input bg-background px-6 text-base font-semibold text-foreground hover:bg-secondary"
            >
              Como funciona
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Documentos cifrados y borrados a los 7 dias
            </li>
            <li className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" aria-hidden />
              Reporte en menos de 24 horas habiles
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" aria-hidden />
              Solo tu y nuestro equipo legal acceden al reporte
            </li>
          </ul>
        </div>

        <aside className="rounded-2xl border border-border bg-card p-6 shadow-elevated">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Cuenta regresiva
              </p>
              <p className="text-base font-semibold">25 de junio de 2026</p>
            </div>
          </div>

          <div className="my-5 flex items-end gap-3">
            <span className="text-6xl font-extrabold tracking-tight text-primary">{days}</span>
            <span className="pb-2 text-sm text-muted-foreground">
              dias para actualizar tu RIT
            </span>
          </div>

          <div className="rounded-md bg-secondary p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Multas por incumplimiento</p>
            <p className="mt-1">
              El Ministerio de Trabajo puede sancionar con multas de 1 a 5.000 SMLMV
              por incumplimiento de las disposiciones laborales aplicables al RIT.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

// ==========================================
// Pricing
// ==========================================

function Pricing() {
  return (
    <section id="planes" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Planes y precios</p>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">
          Pago unico. Sin sorpresas. Precio en pesos colombianos.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
          Elige el plan acorde al tamano de tu empresa. Pagas con Bold, recibes el
          reporte en tu correo y guardas el PDF para auditoria.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3 md:items-stretch">
        {PLANS.map((plan) => (
          <PricingCard key={plan.id} plan={plan} />
        ))}
      </div>
      <p className="mt-10 text-center text-xs text-muted-foreground">
        Aceptamos pagos con tarjeta debito y credito, PSE y Nequi a traves de
        Bold Colombia. Emitimos factura electronica DIAN al NIT informado.
      </p>
    </section>
  );
}

// ==========================================
// Que entregamos
// ==========================================

function Deliverables() {
  const items = [
    {
      icon: <FileSearch className="h-5 w-5" aria-hidden />,
      title: 'Score de cumplimiento sobre 100',
      body:
        'Una calificacion clara que tu Comite Directivo entiende a primera vista, con explicacion de los principales factores que la afectan.',
    },
    {
      icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
      title: 'Hallazgos priorizados por severidad',
      body:
        'Cada hallazgo incluye base legal especifica, riesgo concreto y texto sugerido para incorporar al RIT.',
    },
    {
      icon: <ScrollText className="h-5 w-5" aria-hidden />,
      title: 'Plan de accion con fechas',
      body:
        'Sabes exactamente que cambiar primero, quien deberia hacerlo y para cuando, alineado al plazo del 25 de junio de 2026.',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
      title: 'Reporte revisado por humanos',
      body:
        'Antes de la entrega final, nuestro equipo legal revisa el reporte para evitar recomendaciones automatizadas sin contexto.',
    },
  ];

  return (
    <section id="entregable" className="bg-secondary/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Que recibes
            </p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">
              Un reporte ejecutivo que puedes llevar al comite directivo o a tu abogado.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              No te entregamos un PDF generico ni una lista de plantillas. El
              reporte esta hecho a la medida de tu RIT, citando la normativa
              vigente y senalando exactamente que cambiar.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="grid grid-cols-3 gap-2 border-b border-border pb-4 text-center text-xs uppercase tracking-wider text-muted-foreground">
              <span>Formato</span>
              <span>Lenguaje</span>
              <span>Validacion</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-4 text-sm font-semibold">
              <span>PDF + email seguro</span>
              <span>Espanol juridico</span>
              <span>Equipo legal humano</span>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-card p-6 shadow-card"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                {item.icon}
              </div>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==========================================
// Como funciona
// ==========================================

function Process() {
  const steps = [
    {
      number: '01',
      title: 'Eliges tu plan y pagas con Bold',
      body:
        'Compras con tarjeta, PSE o Nequi. La transaccion es procesada por Bold Colombia y nunca pasa por nuestros servidores.',
    },
    {
      number: '02',
      title: 'Subes tu RIT en PDF o DOCX',
      body:
        'Maximo 15 MB. El archivo viaja cifrado hasta nuestro almacenamiento privado y se borra automaticamente a los 7 dias.',
    },
    {
      number: '03',
      title: 'Analizamos contra la normativa vigente',
      body:
        'Procesamos el documento articulo por articulo, identificamos vacios y riesgos frente a la Ley 2466 y al CST.',
    },
    {
      number: '04',
      title: 'Recibes el reporte ejecutivo en PDF',
      body:
        'Te enviamos un correo con un enlace seguro de descarga. Tu equipo o tu abogado pueden trabajarlo de inmediato.',
    },
  ];

  return (
    <section id="proceso" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Como funciona</p>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">Cuatro pasos. Cero reuniones.</h2>
      </div>
      <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <li
            key={step.number}
            className="relative rounded-xl border border-border bg-card p-6 shadow-card"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Paso {step.number}
            </span>
            <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ==========================================
// Trust
// ==========================================

function TrustSection() {
  return (
    <section className="bg-primary py-16 text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
        <div>
          <Sparkles className="h-6 w-6" aria-hidden />
          <h3 className="mt-3 text-xl font-bold">Construido en Colombia</h3>
          <p className="mt-2 text-sm text-primary-foreground/80">
            Equipo local enfocado exclusivamente en cumplimiento laboral colombiano.
            Sin atajos ni traducciones de plantillas extranjeras.
          </p>
        </div>
        <div>
          <ShieldCheck className="h-6 w-6" aria-hidden />
          <h3 className="mt-3 text-xl font-bold">Privacidad por diseno</h3>
          <p className="mt-2 text-sm text-primary-foreground/80">
            Documentos cifrados, almacenamiento privado y borrado automatico a
            los 7 dias. No usamos tu RIT para entrenar modelos.
          </p>
        </div>
        <div>
          <Gavel className="h-6 w-6" aria-hidden />
          <h3 className="mt-3 text-xl font-bold">Revision humana</h3>
          <p className="mt-2 text-sm text-primary-foreground/80">
            El analisis automatizado pasa por nuestro equipo legal antes de la
            entrega. Ninguna recomendacion sale sin revision.
          </p>
        </div>
      </div>
    </section>
  );
}

// ==========================================
// FAQ
// ==========================================

function FAQ() {
  const items = [
    {
      q: 'Esto reemplaza a mi abogado?',
      a:
        'No. RITCheck Colombia es una herramienta de apoyo que prepara el trabajo. Las recomendaciones deben validarse con un abogado laboral antes de aprobarse formalmente.',
    },
    {
      q: 'Que pasa con mi documento despues del analisis?',
      a:
        'El archivo original se elimina automaticamente a los 7 dias. Solo conservamos metadata minima (tamano, hash y fecha) para auditoria interna.',
    },
    {
      q: 'Cuanto tarda el reporte?',
      a:
        'En el plan Basic entregamos en 24 horas habiles, en Pro en 12 horas y en Premium en 6 horas. Recibiras un correo con el enlace seguro de descarga.',
    },
    {
      q: 'Emiten factura electronica?',
      a:
        'Si. Emitimos factura electronica DIAN al NIT informado al momento de la compra. Si necesitas otro NIT escribenos a soporte@ritcheck.co.',
    },
    {
      q: 'Aceptan PSE y Nequi?',
      a:
        'Si. Procesamos pagos con Bold Colombia, que admite tarjetas debito y credito, PSE y Nequi.',
    },
    {
      q: 'Que pasa si la ley cambia despues del analisis?',
      a:
        'En el plan Premium incluimos versionamiento ante cambios normativos posteriores. En los demas planes puedes solicitar una nueva auditoria con descuento.',
    },
  ];

  return (
    <section id="faq" className="bg-secondary/40 py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Preguntas frecuentes
          </p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Lo que mas nos preguntan</h2>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
          {items.map((item) => (
            <details key={item.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <span className="text-base font-semibold">{item.q}</span>
                <span className="text-2xl font-bold text-primary transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ==========================================
// CTA final
// ==========================================

function FinalCTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 text-center">
      <h2 className="text-3xl font-bold md:text-4xl">
        El plazo no se mueve. Tu RIT si.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
        Empieza con el plan que mejor se ajuste a tu empresa y ten tu reporte
        listo antes de que la fecha limite se convierta en una multa.
      </p>
      <a
        href="#planes"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Ver planes y empezar
      </a>
    </section>
  );
}

// ==========================================
// Footer
// ==========================================

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background py-10 text-sm text-muted-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
        <div>
          <p className="font-bold text-foreground">RITCheck Colombia</p>
          <p className="mt-2">
            Auditoria de Reglamentos Internos de Trabajo frente a la Ley 2466 de
            2025 y al Codigo Sustantivo del Trabajo.
          </p>
        </div>
        <div>
          <p className="font-semibold text-foreground">Contacto</p>
          <ul className="mt-2 space-y-1">
            <li>
              <a href="mailto:soporte@ritcheck.co" className="hover:text-primary">
                soporte@ritcheck.co
              </a>
            </li>
            <li>Bogota, Colombia</li>
            <li>Lunes a viernes 8:00 a.m. - 6:00 p.m.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground">Aviso legal</p>
          <p className="mt-2">
            Este servicio es una herramienta tecnologica de apoyo y no constituye
            asesoria juridica formal. Las recomendaciones deben ser validadas
            por un abogado laboral colombiano antes de su implementacion.
          </p>
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-6xl border-t border-border px-6 pt-6 text-xs">
        <p>
          &copy; {new Date().getFullYear()} RITCheck Colombia. Pagos procesados
          por Bold Colombia. Documentos cifrados y eliminados a los 7 dias.
        </p>
      </div>
    </footer>
  );
}
