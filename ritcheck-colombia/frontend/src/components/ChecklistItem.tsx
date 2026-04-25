// ==========================================
// ARCHIVO: frontend/src/components/ChecklistItem.tsx
// PROPOSITO: Renderiza un item accionable del checklist del reporte
// DEPENDENCIAS: lucide-react
// LLAMADO DESDE: ReportPreview
// ==========================================

import { CircleAlert, CircleCheck } from 'lucide-react';

interface ChecklistItemProps {
  title: string;
  description: string;
  done?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

export function ChecklistItem({ title, description, done = false, priority = 'medium' }: ChecklistItemProps) {
  const Icon = done ? CircleCheck : CircleAlert;

  return (
    <div className="flex gap-3 rounded-md border bg-card p-4">
      <Icon className={done ? 'h-5 w-5 text-primary' : 'h-5 w-5 text-destructive'} aria-hidden="true" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{title}</p>
          <span className="rounded-sm bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{priority}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

