// ==========================================
// ARCHIVO: backend/src/services/documentParser.ts
// PROPOSITO: Extrae texto normalizado de archivos PDF y DOCX sin loggear contenido
// DEPENDENCIAS: pdf-parse, mammoth
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import type { ParsedDocument } from '../types/index.js';

export async function parseDocument(orderId: string, buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
  if (mimeType === 'application/pdf') {
    return parsePdf(orderId, buffer);
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDocx(orderId, buffer);
  }

  throw new Error('Tipo de documento no soportado.');
}

async function parsePdf(orderId: string, buffer: Buffer): Promise<ParsedDocument> {
  const parsed = await pdf(buffer);
  const text = normalizeExtractedText(parsed.text);

  return {
    orderId,
    text,
    pageCount: parsed.numpages,
    wordCount: countWords(text),
    parser: 'pdf-parse',
  };
}

async function parseDocx(orderId: string, buffer: Buffer): Promise<ParsedDocument> {
  const parsed = await mammoth.extractRawText({ buffer });
  const text = normalizeExtractedText(parsed.value);

  return {
    orderId,
    text,
    wordCount: countWords(text),
    parser: 'mammoth',
  };
}

export function normalizeExtractedText(text: string): string {
  // TODO: mejorar normalizacion preservando numerales, capitulos y articulos del RIT.
  return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// TODO: detectar documentos escaneados sin texto y disparar flujo OCR futuro.

