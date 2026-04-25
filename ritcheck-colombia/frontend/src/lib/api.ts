// ==========================================
// ARCHIVO: frontend/src/lib/api.ts
// PROPOSITO: Cliente HTTP tipado para comunicarse con backend Express
// DEPENDENCIAS: fetch, tipos frontend
// LLAMADO DESDE: Paginas y componentes frontend
// ==========================================

import type { CreateOrderRequest, CreateOrderResponse, OrderStatusResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export async function createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  // TODO: agregar manejo de errores, trazabilidad requestId y auth token Supabase.
  const response = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('No fue posible crear la orden.');
  }

  return response.json();
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  // TODO: validar orderId como UUID antes de llamar al backend.
  const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('No fue posible consultar el estado de la orden.');
  }

  return response.json();
}

export async function uploadDocument(orderId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append('document', file);

  // TODO: incluir token de sesion Supabase y CSRF si aplica.
  const response = await fetch(`${API_URL}/uploads/${orderId}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('No fue posible subir el documento.');
  }
}

