// ==========================================
// ARCHIVO: frontend/src/components/UploadZone.tsx
// PROPOSITO: Control de carga segura para PDF/DOCX del RIT
// DEPENDENCIAS: React, API backend
// LLAMADO DESDE: upload/page.tsx
// ==========================================

'use client';

import { UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

interface UploadZoneProps {
  orderIdPlaceholder: string;
}

export function UploadZone({ orderIdPlaceholder }: UploadZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="rounded-md border border-dashed bg-card p-6">
      <UploadCloud className="h-8 w-8 text-primary" aria-hidden="true" />
      <label className="mt-4 block">
        <span className="text-sm font-medium">Archivo RIT en PDF o DOCX</span>
        <input
          className="mt-3 block w-full text-sm"
          type="file"
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="mt-3 text-xs text-muted-foreground">
        Maximo 15 MB. Orden asociada: {orderIdPlaceholder}.
      </p>
      <Button className="mt-5" type="button" disabled={!selectedFile}>
        Subir documento
      </Button>
      {/* TODO: implementar upload multipart/form-data a POST /api/uploads/:orderId. */}
      {/* TODO: validar tamano y MIME en cliente antes de enviar. */}
    </div>
  );
}

