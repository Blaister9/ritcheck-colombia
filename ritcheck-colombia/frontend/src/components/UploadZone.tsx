// ==========================================
// ARCHIVO: frontend/src/components/UploadZone.tsx
// PROPOSITO: Drag & drop seguro de PDF/DOCX con validacion de tipo/tamano
//   en cliente, progress bar y handler para subir al backend.
// DEPENDENCIAS: React, lucide-react, lib/api, lib/utils
// LLAMADO DESDE: app/upload/page.tsx
// ==========================================

'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, ShieldCheck, UploadCloud, XCircle } from 'lucide-react';
import { ApiError, uploadDocument } from '@/lib/api';
import { cn } from '@/lib/utils';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB - debe coincidir con backend.
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx'];

export interface UploadZoneProps {
  orderId: string;
  /** Callback cuando el upload termina con exito. */
  onUploaded: (documentId: string) => void;
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'selected'; file: File }
  | { kind: 'uploading'; file: File; percent: number }
  | { kind: 'success'; file: File; documentId: string }
  | { kind: 'error'; file?: File; message: string };

export function UploadZone({ orderId, onUploaded }: UploadZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: 'idle' });
  const [dragActive, setDragActive] = useState(false);

  const validate = useCallback((file: File): string | null => {
    if (file.size === 0) return 'El archivo esta vacio.';
    if (file.size > MAX_BYTES) {
      return `El archivo pesa ${formatBytes(file.size)}. El maximo permitido es 15 MB.`;
    }
    if (!ACCEPTED_MIME.has(file.type)) {
      const looksOk = ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!looksOk) {
        return 'Solo aceptamos archivos PDF o DOCX. No subas .doc antiguos ni imagenes.';
      }
    }
    return null;
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      const error = validate(file);
      if (error) {
        setState({ kind: 'error', file, message: error });
        return;
      }
      setState({ kind: 'selected', file });
    },
    [validate],
  );

  const startUpload = useCallback(async () => {
    if (state.kind !== 'selected') return;
    const file = state.file;
    setState({ kind: 'uploading', file, percent: 0 });
    try {
      const result = await uploadDocument(orderId, file, {
        onProgress: (percent) => {
          setState((prev) =>
            prev.kind === 'uploading' ? { ...prev, percent } : prev,
          );
        },
      });
      setState({ kind: 'success', file, documentId: result.documentId });
      onUploaded(result.documentId);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? mapUploadErrorCode(err)
          : 'No fue posible subir el documento. Intenta nuevamente.';
      setState({ kind: 'error', file, message });
    }
  }, [orderId, state, onUploaded]);

  const reset = () => setState({ kind: 'idle' });

  // ---- Render ----

  const isUploading = state.kind === 'uploading';
  const showDropzone = state.kind === 'idle' || state.kind === 'error';

  return (
    <div className="flex flex-col gap-4">
      {showDropzone && (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card px-6 py-12 text-center transition',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-primary hover:bg-secondary/50',
          )}
        >
          <UploadCloud className="h-10 w-10 text-primary" aria-hidden />
          <p className="mt-4 text-base font-semibold">
            Arrastra tu RIT aqui o haz clic para elegirlo
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            PDF o DOCX. Maximo 15 MB.
          </p>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      )}

      {(state.kind === 'selected' || state.kind === 'uploading' || state.kind === 'success' || state.kind === 'error') && state.file && (
        <FilePreview
          file={state.file}
          state={state}
          onReplace={reset}
          onUpload={startUpload}
          orderId={orderId}
        />
      )}

      {state.kind === 'error' && !state.file && (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <SecurityNote />

      {isUploading && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          No cierres esta ventana hasta que termine la subida.
        </p>
      )}
    </div>
  );
}

interface FilePreviewProps {
  file: File;
  state: UploadState;
  orderId: string;
  onReplace: () => void;
  onUpload: () => void;
}

function FilePreview({ file, state, orderId, onReplace, onUpload }: FilePreviewProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="rounded-md bg-secondary p-3">
          <FileText className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="truncate text-sm font-semibold">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(file.size)} &middot; orden {orderId.slice(0, 8)}
          </p>

          {state.kind === 'uploading' && <ProgressBar percent={state.percent} />}

          {state.kind === 'success' && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Documento recibido. Encolando analisis...
            </p>
          )}

          {state.kind === 'error' && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" aria-hidden />
              {state.message}
            </p>
          )}
        </div>
      </div>

      {state.kind !== 'success' && (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onReplace}
            disabled={state.kind === 'uploading'}
            className="h-10 rounded-md border border-input px-4 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
          >
            Cambiar archivo
          </button>
          {state.kind !== 'uploading' && (
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {state.kind === 'error' ? 'Reintentar subida' : 'Subir y empezar analisis'}
            </button>
          )}
          {state.kind === 'uploading' && (
            <span className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Subiendo...
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-2 rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.max(4, percent)}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        />
      </div>
      <p className="text-xs font-medium text-muted-foreground">{percent}%</p>
    </div>
  );
}

function SecurityNote() {
  return (
    <aside className="flex items-start gap-3 rounded-md bg-secondary px-4 py-3 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div>
        <strong className="block text-foreground">Tu documento viaja cifrado.</strong>
        Solo nuestro motor de analisis lo procesa. El archivo original se elimina
        automaticamente a los 7 dias.
      </div>
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mapUploadErrorCode(err: ApiError): string {
  switch (err.code) {
    case 'FILE_REQUIRED':
      return 'Debes adjuntar un archivo PDF o DOCX.';
    case 'FILE_TOO_LARGE':
      return 'El archivo excede el maximo permitido (15 MB).';
    case 'INVALID_STATE':
      return 'La orden no esta lista para recibir documentos. Revisa el estado del pago.';
    case 'OCR_REQUIRED':
      return 'El documento parece estar escaneado. Sube un PDF/DOCX con texto seleccionable.';
    case 'PARSE_FAILED':
      return 'No fue posible leer el archivo. Verifica que no este protegido con contrasena.';
    case 'UNSUPPORTED_MIME':
      return 'Tipo de archivo no soportado. Usa PDF o DOCX moderno.';
    default:
      return err.message || 'No fue posible subir el documento.';
  }
}
