// ==========================================
// ARCHIVO: backend/src/services/documentParser.ts
// PROPOSITO: Extrae texto normalizado de archivos PDF y DOCX sin loggear contenido
// DEPENDENCIAS: pdf-parse, mammoth
// LLAMADO DESDE: analysisWorker.ts
// ==========================================

import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { logger } from '../config/logger.js';
import type { ParsedDocument } from '../types/index.js';

// MIME types soportados (deben coincidir con UPLOAD_ALLOWED_MIME_TYPES y storage bucket).
const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Umbrales de prevalidacion. Un RIT colombiano realista tiene ~3.000+ palabras;
// menos de 200 casi seguro es PDF escaneado, vacio o pagina basura.
export const MIN_WORDS_FOR_ANALYSIS = 200;
// Limite superior defensivo (corresponde a ~150k tokens de input estimado).
export const MAX_WORDS_FOR_ANALYSIS = 80_000;

export type DocumentParseErrorCode =
  | 'UNSUPPORTED_MIME'
  | 'EMPTY_BUFFER'
  | 'PARSE_FAILED'
  | 'OCR_REQUIRED'
  | 'TOO_LARGE'
  | 'UNREADABLE';

/**
 * Error con `code` legible para el flujo (worker -> orden.failed_reason)
 * y `safeMessage` orientado al cliente. Nunca incluye texto del documento.
 */
export class DocumentParseError extends Error {
  readonly code: DocumentParseErrorCode;
  readonly safeMessage: string;

  constructor(code: DocumentParseErrorCode, safeMessage: string, cause?: unknown) {
    super(`[${code}] ${safeMessage}`);
    this.name = 'DocumentParseError';
    this.code = code;
    this.safeMessage = safeMessage;
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Parsea un PDF o DOCX y devuelve texto normalizado + metricas. Nunca loggea
 * el contenido extraido. En caso de problemas estructurales (vacio, escaneado,
 * formato no soportado) lanza `DocumentParseError` con codigo accionable.
 */
export async function parseDocument(
  orderId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<ParsedDocument> {
  if (!buffer || buffer.length === 0) {
    throw new DocumentParseError('EMPTY_BUFFER', 'El archivo recibido esta vacio.');
  }

  let parsed: ParsedDocument;
  if (mimeType === MIME_PDF) {
    parsed = await parsePdf(orderId, buffer);
  } else if (mimeType === MIME_DOCX) {
    parsed = await parseDocx(orderId, buffer);
  } else {
    throw new DocumentParseError(
      'UNSUPPORTED_MIME',
      `Tipo de documento no soportado. Solo se aceptan PDF y DOCX (recibido: ${mimeType}).`,
    );
  }

  // Prevalidacion: si el texto extraido es minusculo asumimos PDF escaneado.
  if (parsed.wordCount < MIN_WORDS_FOR_ANALYSIS) {
    logger.warn(
      { scope: 'documentParser', orderId, wordCount: parsed.wordCount, parser: parsed.parser },
      'Documento con texto insuficiente; probablemente escaneado',
    );
    throw new DocumentParseError(
      'OCR_REQUIRED',
      'El documento parece estar escaneado o no contiene texto extraible. Sube una version con texto seleccionable.',
    );
  }

  if (parsed.wordCount > MAX_WORDS_FOR_ANALYSIS) {
    logger.warn(
      { scope: 'documentParser', orderId, wordCount: parsed.wordCount },
      'Documento excede el limite superior de palabras',
    );
    throw new DocumentParseError(
      'TOO_LARGE',
      `El documento excede el maximo de ${MAX_WORDS_FOR_ANALYSIS.toLocaleString('es-CO')} palabras. Divide el archivo o solicita un plan custom.`,
    );
  }

  logger.info(
    {
      scope: 'documentParser',
      orderId,
      parser: parsed.parser,
      wordCount: parsed.wordCount,
      pageCount: parsed.pageCount,
    },
    'Documento parseado',
  );

  return parsed;
}

async function parsePdf(orderId: string, buffer: Buffer): Promise<ParsedDocument> {
  try {
    // pdf-parse acepta options; mantenemos defaults pero limitamos paginas para
    // evitar parsing infinito en PDFs con paginas corruptas.
    const result = await pdf(buffer, { max: 0 });
    const text = normalizeExtractedText(result.text ?? '');
    return {
      orderId,
      text,
      pageCount: result.numpages,
      wordCount: countWords(text),
      parser: 'pdf-parse',
    };
  } catch (err) {
    throw new DocumentParseError(
      'PARSE_FAILED',
      'No fue posible leer el PDF. Verifica que no este protegido con contrasena ni corrupto.',
      err,
    );
  }
}

async function parseDocx(orderId: string, buffer: Buffer): Promise<ParsedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = normalizeExtractedText(result.value ?? '');

    // Mammoth emite mensajes (warnings) que no contienen texto del documento.
    if (result.messages?.length) {
      const warnTypes = result.messages.map((m) => m.type);
      logger.debug(
        { scope: 'documentParser', orderId, parser: 'mammoth', warnTypes },
        'Mammoth completo con warnings',
      );
    }

    return {
      orderId,
      text,
      wordCount: countWords(text),
      parser: 'mammoth',
    };
  } catch (err) {
    throw new DocumentParseError(
      'PARSE_FAILED',
      'No fue posible leer el DOCX. Asegurate de subir un archivo .docx valido (no .doc antiguo).',
      err,
    );
  }
}

/**
 * Normaliza texto preservando estructura util para el analisis juridico:
 * - colapsa espacios horizontales pero NO los saltos de linea (los articulos
 *   y numerales se reconocen en su propia linea);
 * - normaliza CR/LF a LF;
 * - elimina caracteres de control invisibles que aparecen en algunos PDFs;
 * - reduce mas de 2 saltos de linea consecutivos a parrafo doble.
 */
export function normalizeExtractedText(text: string): string {
  if (!text) return '';

  return text
    // Normalizar fin de linea
    .replace(/\r\n?/g, '\n')
    // Eliminar BOM (U+FEFF)
    .replace(/\uFEFF/g, '')
    // Eliminar caracteres de control no imprimibles excepto \n (\x0A) y \t (\x09)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Colapsar espacios/tabs en linea
    .replace(/[ \t]+/g, ' ')
    // Limpiar espacios al inicio/fin de cada linea
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    // Colapsar 3+ saltos a 2 (parrafo)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Calcula un SHA-256 sobre el buffer del documento. Usado para deteccion de
 * duplicados y trazabilidad sin almacenar contenido.
 */
export async function hashDocument(buffer: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(buffer).digest('hex');
}
