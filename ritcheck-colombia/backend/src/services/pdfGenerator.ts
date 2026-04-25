// ==========================================
// ARCHIVO: backend/src/services/pdfGenerator.ts
// PROPOSITO: Genera PDF profesional desde template HTML y resultado combinado
// DEPENDENCIAS: Playwright, templates/report.html, tipos
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type {
  ActionPlanItem,
  ChecklistItem,
  CombinedAnalysisResult,
  LegalFinding,
  Order,
  Severity,
} from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolvemos la ruta del template de forma robusta:
//   1. ENV explicita (REPORT_TEMPLATE_PATH si la agregamos en el futuro).
//   2. Relativa al cwd cuando se ejecuta `node` desde la raiz del backend.
//   3. Relativa al propio archivo compilado en `dist`.
const TEMPLATE_CANDIDATES = [
  process.env.REPORT_TEMPLATE_PATH,
  resolve(process.cwd(), 'templates/report.html'),
  resolve(process.cwd(), '..', 'templates/report.html'),
  resolve(__dirname, '../../../templates/report.html'),
  resolve(__dirname, '../../../../templates/report.html'),
].filter((p): p is string => Boolean(p));

const PLAN_LABELS: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

let cachedTemplate: string | null = null;

/**
 * Genera el PDF del reporte. Usa Playwright para renderizar el template HTML
 * y exportarlo a A4. No carga recursos externos (defensa contra SSRF/CSP).
 */
export async function generateReportPdf(
  order: Order,
  analysis: CombinedAnalysisResult,
): Promise<Buffer> {
  const html = renderReportHtml(await loadTemplate(), order, analysis);

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Defensa contra SSRF: el template es totalmente local, asi que rechazamos
    // cualquier request distinto a data:/about: por si alguien edita el HTML
    // en el futuro y agrega un <img src="https://..."> o similar.
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:') || url.startsWith('about:')) return route.continue();
      return route.abort();
    });

    await page.setContent(html, {
      waitUntil: 'load',
      timeout: env.PDF_RENDER_TIMEOUT_MS,
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });

    logger.info(
      {
        scope: 'pdfGenerator',
        orderId: order.id,
        sizeBytes: pdf.length,
        score: analysis.score,
        findings: analysis.findings.length,
      },
      'PDF generado',
    );

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
}

/**
 * Renderiza el template reemplazando placeholders con datos seguros (escape HTML).
 * Exportada para tests y reuso.
 */
export function renderReportHtml(
  template: string,
  order: Order,
  analysis: CombinedAnalysisResult,
): string {
  const score = clampScore(analysis.score);
  const severityCounts = countBySeverity(analysis.findings);
  const supportEmail = env.EMAIL_REPLY_TO;

  const replacements: Record<string, string> = {
    '{{ORDER_ID}}': escapeHtml(order.id),
    '{{ORDER_ID_SHORT}}': escapeHtml(order.id.slice(0, 8)),
    '{{PLAN_NAME}}': escapeHtml(PLAN_LABELS[order.planId] ?? order.planId),
    '{{GENERATED_AT}}': escapeHtml(formatDateTime(new Date())),
    '{{COMPANY_NAME}}': escapeHtml(order.customer.companyName ?? 'Empresa cliente'),
    '{{COMPANY_NIT_LINE}}': order.customer.companyNit
      ? `NIT ${escapeHtml(order.customer.companyNit)}`
      : 'NIT no informado',
    '{{SCORE}}': String(score),
    '{{SCORE_COLOR}}': scoreColor(score),
    '{{FINDINGS_COUNT}}': String(analysis.findings.length),
    '{{CRITICAL_COUNT}}': String(severityCounts.critical),
    '{{HIGH_COUNT}}': String(severityCounts.high),
    '{{MANUAL_REVIEW_BADGE}}': analysis.requiresManualReview
      ? '<span class="badge badge-warning">Revision humana sugerida</span>'
      : '',
    '{{EXECUTIVE_SUMMARY}}': escapeHtml(analysis.executiveSummary),
    '{{FINDINGS_HTML}}': renderFindings(analysis.findings),
    '{{CHECKLIST_HTML}}': renderChecklist(analysis.checklist),
    '{{ACTION_PLAN_HTML}}': renderActionPlan(analysis.actionPlan),
    '{{RETENTION_DAYS}}': String(env.DOCUMENT_RETENTION_DAYS),
    '{{SUPPORT_EMAIL}}': escapeHtml(supportEmail),
  };

  let html = template;
  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }
  return html;
}

// ---- Internals ----

async function loadTemplate(): Promise<string> {
  if (cachedTemplate) return cachedTemplate;

  let lastError: unknown;
  for (const candidate of TEMPLATE_CANDIDATES) {
    try {
      const content = await readFile(candidate, 'utf8');
      cachedTemplate = content;
      logger.debug({ scope: 'pdfGenerator', templatePath: candidate }, 'Template HTML cargado');
      return content;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `No fue posible cargar templates/report.html. Intentos: ${TEMPLATE_CANDIDATES.join(', ')} - Error: ${
      (lastError as Error)?.message ?? 'desconocido'
    }`,
  );
}

function renderFindings(findings: LegalFinding[]): string {
  if (!findings || findings.length === 0) {
    return '<p class="empty-state">No se identificaron hallazgos juridicos relevantes.</p>';
  }

  return findings
    .map((finding, index) => {
      const severity = (finding.severity ?? 'medium') as Severity;
      const excerpt = finding.currentTextExcerpt?.trim()
        ? `<div class="finding-excerpt"><strong>Texto actual:</strong> ${escapeHtml(
            finding.currentTextExcerpt.slice(0, 1500),
          )}</div>`
        : '';

      return `
        <article class="finding" data-severity="${severity}">
          <div class="finding-header">
            <h3 class="finding-title">${index + 1}. ${escapeHtml(finding.title)}</h3>
            <span class="severity-pill" data-severity="${severity}">${SEVERITY_LABELS[severity]}</span>
          </div>
          <div class="finding-body">
            <p class="legal-basis"><strong>Base legal:</strong> ${escapeHtml(finding.legalBasis)}</p>
            <p><strong>Problema:</strong> ${escapeHtml(finding.issue)}</p>
            <p><strong>Riesgo:</strong> ${escapeHtml(finding.risk)}</p>
            ${excerpt}
            <div class="finding-suggestion"><strong>Texto sugerido:</strong> ${escapeHtml(
              finding.suggestedText,
            )}</div>
          </div>
        </article>
      `;
    })
    .join('\n');
}

function renderChecklist(items: ChecklistItem[]): string {
  if (!items || items.length === 0) {
    return '<p class="empty-state">No hay tareas pendientes en el checklist.</p>';
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td><span class="severity-pill" data-severity="${item.severity}">${
            SEVERITY_LABELS[item.severity as Severity] ?? escapeHtml(item.severity)
          }</span></td>
          <td>${escapeHtml(item.ownerRole ?? 'No asignado')}</td>
          <td>${escapeHtml(item.dueDate ?? '-')}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <table class="data">
      <thead>
        <tr>
          <th>Tarea</th>
          <th>Descripcion</th>
          <th>Prioridad</th>
          <th>Responsable</th>
          <th>Plazo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderActionPlan(items: ActionPlanItem[]): string {
  if (!items || items.length === 0) {
    return '<p class="empty-state">No se generaron acciones especificas en este plan.</p>';
  }

  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  const rows = sorted
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.action)}</td>
          <td>${item.priority}</td>
          <td>${escapeHtml(item.dueDate)}</td>
          <td>${escapeHtml(item.rationale)}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <table class="data">
      <thead>
        <tr>
          <th>#</th>
          <th>Accion</th>
          <th>Prioridad</th>
          <th>Fecha objetivo</th>
          <th>Justificacion</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function countBySeverity(findings: LegalFinding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    const sev = (f.severity ?? 'medium') as Severity;
    counts[sev] = (counts[sev] ?? 0) + 1;
  }
  return counts;
}

function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a'; // verde
  if (score >= 60) return '#ca8a04'; // ambar
  if (score >= 40) return '#d97706'; // naranja
  return '#b91c1c'; // rojo
}

function formatDateTime(date: Date): string {
  // Bogota, 24h, sin segundos.
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: env.APP_TIMEZONE || 'America/Bogota',
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// TODO: agregar snapshots visuales del PDF con datos fixture antes de produccion.
// TODO: incorporar logo SVG inline en el header cuando exista identidad final.
