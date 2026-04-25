// ==========================================
// ARCHIVO: backend/src/services/storageService.ts
// PROPOSITO: Guarda, firma y elimina documentos/reportes en Supabase Storage,
//   y persiste metadata en `documents`, `reports`, `document_retention_jobs`.
// DEPENDENCIAS: Supabase Admin, crypto, env, logger
// LLAMADO DESDE: routes/upload.ts, services/pdfGenerator.ts, workers/analysisWorker.ts,
//   workers/cleanupWorker.ts
// ==========================================

import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  buildDocumentStoragePath,
  buildReportStoragePath,
  reportsBucket,
  ritDocumentsBucket,
  supabaseAdmin,
} from '../config/supabase.js';
import type { UploadedDocument } from '../types/index.js';

export class StorageServiceError extends Error {
  readonly code: string;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageServiceError';
    this.code = code;
    if (cause) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Sube el documento RIT al bucket privado y registra metadata en `documents` y
 * `document_retention_jobs`. No persiste el texto del documento, solo su path,
 * checksum y atributos basicos. Es idempotente respecto a re-subidas mediante
 * el unique (storage_bucket, storage_path).
 */
export async function storeUploadedDocument(
  orderId: string,
  file: Express.Multer.File,
): Promise<UploadedDocument> {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new StorageServiceError('EMPTY_FILE', 'Archivo recibido vacio.');
  }

  const documentId = crypto.randomUUID();
  const storagePath = buildDocumentStoragePath(orderId, file.originalname || `${documentId}`);
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const uploadedAt = new Date();
  const deleteAfter = new Date(
    uploadedAt.getTime() + env.DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );

  // 1. Subida fisica al bucket privado.
  const { error: uploadError } = await supabaseAdmin.storage
    .from(ritDocumentsBucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
      cacheControl: 'private, no-store',
    });

  if (uploadError) {
    logger.error(
      {
        scope: 'storageService',
        orderId,
        bucket: ritDocumentsBucket,
        code: 'UPLOAD_FAILED',
        err: { name: uploadError.name, message: uploadError.message },
      },
      'No fue posible subir documento al storage',
    );
    throw new StorageServiceError(
      'UPLOAD_FAILED',
      'No fue posible subir el documento. Intenta nuevamente.',
      uploadError,
    );
  }

  // 2. Insertar metadata en documents. Si falla, hacer rollback del archivo
  //    para no dejar huerfanos en storage.
  const { data: docRow, error: insertError } = await supabaseAdmin
    .from('documents')
    .insert({
      id: documentId,
      order_id: orderId,
      original_filename: sanitizeFilename(file.originalname),
      mime_type: file.mimetype,
      size_bytes: file.size,
      sha256,
      storage_bucket: ritDocumentsBucket,
      storage_path: storagePath,
      parse_status: 'pending',
      uploaded_at: uploadedAt.toISOString(),
      delete_after: deleteAfter.toISOString(),
    })
    .select('id')
    .single();

  if (insertError || !docRow) {
    logger.error(
      {
        scope: 'storageService',
        orderId,
        code: 'DB_INSERT_FAILED',
        err: insertError ? { message: insertError.message } : undefined,
      },
      'Insert en documents fallo, intentando rollback del archivo subido',
    );
    await removeFromBucket(ritDocumentsBucket, storagePath).catch(() => undefined);
    throw new StorageServiceError(
      'DB_INSERT_FAILED',
      'No fue posible registrar el documento.',
      insertError,
    );
  }

  // 3. Encolar trabajo de retencion (cleanupWorker lo consumira).
  const { error: retentionError } = await supabaseAdmin
    .from('document_retention_jobs')
    .insert({
      document_id: documentId,
      delete_after: deleteAfter.toISOString(),
      status: 'queued',
    });

  if (retentionError) {
    // No es bloqueante: el documento queda registrado y un job batch puede
    // recogerlo despues. Logueamos para alertas.
    logger.warn(
      {
        scope: 'storageService',
        documentId,
        err: { message: retentionError.message },
      },
      'No fue posible registrar document_retention_jobs (continuamos)',
    );
  }

  return {
    id: documentId,
    orderId,
    storagePath,
    originalFilename: sanitizeFilename(file.originalname),
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    uploadedAt: uploadedAt.toISOString(),
    deleteAfter: deleteAfter.toISOString(),
  };
}

/**
 * Descarga el binario del documento desde el bucket privado.
 * No verifica autorizacion: la decision de quien puede descargar debe vivir
 * en la capa de servicio que llama (workers o ruta autenticada).
 */
export async function downloadDocumentBuffer(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage
    .from(ritDocumentsBucket)
    .download(storagePath);

  if (error || !data) {
    logger.error(
      {
        scope: 'storageService',
        bucket: ritDocumentsBucket,
        code: 'DOWNLOAD_FAILED',
        err: error ? { message: error.message } : undefined,
      },
      'No fue posible descargar documento',
    );
    throw new StorageServiceError(
      'DOWNLOAD_FAILED',
      'No fue posible descargar el documento.',
      error ?? undefined,
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

/**
 * Sube el reporte PDF generado al bucket privado `reports`. Asigna version
 * incremental por orderId, registra metadata en `reports` y devuelve el
 * storage path final para construir signed URLs.
 */
export async function uploadReportPdf(orderId: string, pdfBuffer: Buffer): Promise<{
  storagePath: string;
  version: number;
  sha256: string;
}> {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new StorageServiceError('EMPTY_PDF', 'PDF generado vacio.');
  }

  // Versioning incremental basado en filas existentes para esta orden.
  const { data: existing, error: countError } = await supabaseAdmin
    .from('reports')
    .select('version')
    .eq('order_id', orderId)
    .order('version', { ascending: false })
    .limit(1);

  if (countError) {
    throw new StorageServiceError(
      'VERSION_LOOKUP_FAILED',
      'No fue posible determinar version del reporte.',
      countError,
    );
  }

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  const storagePath = buildReportStoragePath(orderId, nextVersion);
  const sha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

  const { error: uploadError } = await supabaseAdmin.storage
    .from(reportsBucket)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: 'private, no-store',
    });

  if (uploadError) {
    throw new StorageServiceError(
      'REPORT_UPLOAD_FAILED',
      'No fue posible subir el reporte PDF.',
      uploadError,
    );
  }

  const { error: insertError } = await supabaseAdmin.from('reports').insert({
    order_id: orderId,
    storage_bucket: reportsBucket,
    storage_path: storagePath,
    version: nextVersion,
    sha256,
    generated_at: new Date().toISOString(),
  });

  if (insertError) {
    // Si el insert de metadata falla, dejamos el archivo (es regenerable) y
    // logueamos para reintento manual.
    logger.warn(
      {
        scope: 'storageService',
        orderId,
        version: nextVersion,
        err: { message: insertError.message },
      },
      'Insert en reports fallo (archivo permanece en storage)',
    );
  }

  return { storagePath, version: nextVersion, sha256 };
}

/**
 * Crea una URL firmada para el reporte. La TTL viene de
 * REPORT_SIGNED_URL_TTL_SECONDS y por defecto es 7 dias.
 */
export async function createSignedReportUrl(storagePath: string): Promise<{
  url: string;
  expiresAt: string;
}> {
  const ttl = env.REPORT_SIGNED_URL_TTL_SECONDS;
  const { data, error } = await supabaseAdmin.storage
    .from(reportsBucket)
    .createSignedUrl(storagePath, ttl);

  if (error || !data?.signedUrl) {
    throw new StorageServiceError(
      'SIGNED_URL_FAILED',
      'No fue posible crear URL firmada del reporte.',
      error ?? undefined,
    );
  }

  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  // Persistir la fecha de expiracion mas reciente para la fila actual del
  // reporte (best-effort; no bloqueante).
  await supabaseAdmin
    .from('reports')
    .update({ signed_url_expires_at: expiresAt })
    .eq('storage_bucket', reportsBucket)
    .eq('storage_path', storagePath);

  return { url: data.signedUrl, expiresAt };
}

/**
 * Devuelve el ultimo reporte (mayor version) para una orden, o null si no existe.
 */
export async function getLatestReportForOrder(orderId: string): Promise<{
  storagePath: string;
  version: number;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('reports')
    .select('storage_path, version')
    .eq('order_id', orderId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new StorageServiceError(
      'REPORT_LOOKUP_FAILED',
      'No fue posible consultar reporte.',
      error,
    );
  }
  if (!data) return null;
  return { storagePath: data.storage_path as string, version: data.version as number };
}

/**
 * Borra documentos cuya retencion ya vencio, marca `deleted_at` y cierra el
 * `document_retention_jobs`. Devuelve la cantidad efectivamente borrada.
 */
export async function deleteExpiredDocuments(beforeIso: string): Promise<number> {
  const { data: expired, error } = await supabaseAdmin
    .from('documents')
    .select('id, storage_bucket, storage_path')
    .is('deleted_at', null)
    .lte('delete_after', beforeIso)
    .limit(500);

  if (error) {
    throw new StorageServiceError(
      'EXPIRED_LOOKUP_FAILED',
      'No fue posible consultar documentos vencidos.',
      error,
    );
  }
  if (!expired || expired.length === 0) return 0;

  let deletedCount = 0;

  for (const row of expired) {
    const docId = row.id as string;
    const bucket = row.storage_bucket as string;
    const path = row.storage_path as string;

    try {
      await removeFromBucket(bucket, path);
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from('documents')
        .update({ deleted_at: nowIso, parse_status: 'deleted' })
        .eq('id', docId);

      if (updateError) {
        logger.warn(
          { scope: 'storageService', documentId: docId, err: { message: updateError.message } },
          'Documento borrado del bucket pero update en documents fallo',
        );
        continue;
      }

      await supabaseAdmin
        .from('document_retention_jobs')
        .update({ status: 'completed' })
        .eq('document_id', docId);

      deletedCount += 1;
    } catch (err) {
      logger.error(
        {
          scope: 'storageService',
          documentId: docId,
          err: { message: (err as Error).message },
        },
        'Fallo borrado de documento expirado',
      );
      // Incrementar attempts via expression no es posible directamente con
      // supabase-js; lo hacemos en dos pasos para mantener trazabilidad.
      const { data: jobRow } = await supabaseAdmin
        .from('document_retention_jobs')
        .select('attempts')
        .eq('document_id', docId)
        .maybeSingle();
      const previousAttempts = (jobRow?.attempts as number | undefined) ?? 0;
      await supabaseAdmin
        .from('document_retention_jobs')
        .update({
          status: 'failed',
          last_error: ((err as Error).message ?? 'unknown').slice(0, 500),
          attempts: previousAttempts + 1,
        })
        .eq('document_id', docId);
    }
  }

  return deletedCount;
}

// ---- Internals ----

async function removeFromBucket(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) {
    throw new StorageServiceError(
      'REMOVE_FAILED',
      `No fue posible eliminar archivo de storage (${bucket}/${path}).`,
      error,
    );
  }
}

function sanitizeFilename(name: string): string {
  if (!name) return 'documento';
  const last = name.split(/[/\\]/).pop() ?? 'documento';
  return last.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200);
}

// TODO: agregar streaming de uploads grandes via signed upload URLs cuando
// crezca el limite del plan premium.
