// ==========================================
// ARCHIVO: frontend/src/app/upload/page.tsx
// PROPOSITO: Pantalla para cargar el RIT despues de pago confirmado
// DEPENDENCIAS: UploadZone, API backend
// LLAMADO DESDE: Ruta /upload
// ==========================================

import { UploadZone } from '@/components/UploadZone';

export default function UploadPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Carga segura</p>
      <h1 className="mt-3 text-3xl font-bold">Sube tu Reglamento Interno de Trabajo</h1>
      <p className="mt-3 text-muted-foreground">
        Aceptamos PDF o DOCX. El documento se elimina automaticamente 7 dias despues del analisis.
      </p>
      <div className="mt-8">
        <UploadZone orderIdPlaceholder="TODO_ORDER_ID" />
      </div>
    </main>
  );
}

