// ==========================================
// ARCHIVO: backend/src/services/storageService.ts
// PROPOSITO: Guarda, firma y elimina documentos/reportes en Supabase Storage
// DEPENDENCIAS: Supabase Admin, crypto, env
// LLAMADO DESDE: upload route, pdfGenerator, cleanupWorker
// ==========================================

import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import type { UploadedDocument } from '../types/index.js';

export async function storeUploadedDocument(orderId: string, file: Express.Multer.File): Promise<UploadedDocument> {
  const documentId = crypto.randomUUID();
  const extension = file.mimetype.includes('pdf') ? 'pdf' : 'docx';
  const storagePath = `${orderId}/${documentId}.${extension}`;
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const deleteAfter = new Date(Date.now() + env.DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // TODO: subir file.buffer a bucket privado rit-documents con contentType correcto.
  // TODO: insertar metadata en documents y document_retention_jobs.
  await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET_RIT).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  return {
    id: documentId,
    orderId,
    storagePath,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    uploadedAt: new Date().toISOString(),
    deleteAfter,
  };
}

export async function downloadDocumentBuffer(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET_RIT).download(storagePath);

  if (error || !data) {
    throw new Error('No fue posible descargar el documento.');
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function uploadReportPdf(orderId: string, pdfBuffer: Buffer): Promise<string> {
  const storagePath = `${orderId}/report.pdf`;
  // TODO: insertar version de reporte y checksum.
  await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET_REPORTS).upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });
  return storagePath;
}

export async function createSignedReportUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(env.SUPABASE_STORAGE_BUCKET_REPORTS)
    .createSignedUrl(storagePath, env.REPORT_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error('No fue posible crear URL firmada del reporte.');
  }

  return data.signedUrl;
}

export async function deleteExpiredDocuments(beforeIso: string): Promise<number> {
  // TODO: consultar documents donde delete_after <= beforeIso y deleted_at is null.
  // TODO: eliminar de storage y marcar deleted_at; retornar cantidad eliminada.
  void beforeIso;
  return 0;
}

