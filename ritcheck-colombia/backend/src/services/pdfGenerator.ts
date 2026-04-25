// ==========================================
// ARCHIVO: backend/src/services/pdfGenerator.ts
// PROPOSITO: Genera PDF profesional desde template HTML y resultado combinado
// DEPENDENCIAS: Playwright, templates/report.html, tipos
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { env } from '../config/env.js';
import type { CombinedAnalysisResult, Order } from '../types/index.js';

export async function generateReportPdf(order: Order, analysis: CombinedAnalysisResult): Promise<Buffer> {
  const templatePath = resolve(process.cwd(), '../templates/report.html');
  const htmlTemplate = await readFile(templatePath, 'utf8');
  const html = renderReportHtml(htmlTemplate, order, analysis);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle', timeout: env.PDF_RENDER_TIMEOUT_MS });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function renderReportHtml(template: string, order: Order, analysis: CombinedAnalysisResult): string {
  // TODO: reemplazar placeholders con escaping HTML seguro.
  // TODO: renderizar hallazgos, checklist, plan de accion y disclaimer.
  return template
    .replaceAll('{{ORDER_ID}}', order.id)
    .replaceAll('{{SCORE}}', String(analysis.score))
    .replaceAll('{{EXECUTIVE_SUMMARY}}', analysis.executiveSummary);
}

// TODO: agregar snapshots visuales del PDF con datos fixture antes de produccion.

