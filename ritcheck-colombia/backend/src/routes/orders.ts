// ==========================================
// ARCHIVO: backend/src/routes/orders.ts
// PROPOSITO: Endpoints para crear ordenes y consultar estado/reporte
// DEPENDENCIAS: express, zod, orderService, rateLimit
// LLAMADO DESDE: index.ts
// ==========================================

import { Router } from 'express';
import { z } from 'zod';
import { orderCreationRateLimit, statusRateLimit } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { createOrder, getOrderReport, getOrderStatus } from '../services/orderService.js';

export const ordersRouter = Router();

const createOrderSchema = z.object({
  planId: z.enum(['basic', 'pro', 'premium']),
  customerEmail: z.string().email(),
  customerName: z.string().min(2).max(120).optional(),
  companyName: z.string().min(2).max(180).optional(),
  companyNit: z.string().regex(/^[0-9.-]{6,20}$/).optional(),
});

const orderParamsSchema = z.object({
  orderId: z.string().uuid(),
});

ordersRouter.post('/', orderCreationRateLimit, validate({ body: createOrderSchema }), async (req, res, next) => {
  try {
    const order = await createOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:orderId/status', statusRateLimit, validate({ params: orderParamsSchema }), async (req, res, next) => {
  try {
    const status = await getOrderStatus(req.params.orderId);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

ordersRouter.get('/:orderId/report', statusRateLimit, validate({ params: orderParamsSchema }), async (req, res, next) => {
  try {
    const report = await getOrderReport(req.params.orderId);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// TODO: agregar autenticacion o token firmado para evitar enumeracion de UUIDs de reportes.

