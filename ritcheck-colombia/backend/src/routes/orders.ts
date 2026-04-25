// ==========================================
// ARCHIVO: backend/src/routes/orders.ts
// PROPOSITO: Endpoints para crear ordenes y consultar estado/reporte
// DEPENDENCIAS: express, zod, orderService, rateLimit, auth
// LLAMADO DESDE: index.ts
// ==========================================

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { requireOrderAccess, signOrderToken } from '../middleware/auth.js';
import {
  orderCreationRateLimit,
  statusRateLimit,
} from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  createOrder,
  getOrderReport,
  getOrderStatus,
} from '../services/orderService.js';

export const ordersRouter = Router();

const createOrderSchema = z.object({
  planId: z.enum(['basic', 'pro', 'premium']),
  customerEmail: z.string().email().max(254),
  customerName: z.string().min(2).max(120).optional(),
  companyName: z.string().min(2).max(180).optional(),
  // NIT colombiano: 6-15 digitos opcionalmente con guion para DV.
  companyNit: z
    .string()
    .regex(/^[0-9.-]{6,20}$/u, 'Formato de NIT invalido.')
    .optional(),
});

const orderParamsSchema = z.object({
  orderId: z.string().uuid(),
});

ordersRouter.post(
  '/',
  orderCreationRateLimit,
  validate({ body: createOrderSchema }),
  async (req, res, next) => {
    try {
      const order = await createOrder(req.body);
      // Token firmado para que el cliente anonimo pueda consultar estado/reporte
      // sin tener cuenta. El frontend lo guarda en localStorage o URL.
      const orderToken = signOrderToken(order.orderId);
      logger.info(
        {
          scope: 'routes/orders',
          orderId: order.orderId,
          planId: req.body.planId,
        },
        'Orden creada',
      );
      return res.status(201).json({
        ...order,
        orderToken,
      });
    } catch (error) {
      return next(error);
    }
  },
);

ordersRouter.get(
  '/:orderId/status',
  statusRateLimit,
  validate({ params: orderParamsSchema }),
  requireOrderAccess,
  async (req, res, next) => {
    try {
      const status = await getOrderStatus(req.params.orderId);
      return res.json(status);
    } catch (error) {
      return next(error);
    }
  },
);

ordersRouter.get(
  '/:orderId/report',
  statusRateLimit,
  validate({ params: orderParamsSchema }),
  requireOrderAccess,
  async (req, res, next) => {
    try {
      const report = await getOrderReport(req.params.orderId);
      return res.json(report);
    } catch (error) {
      return next(error);
    }
  },
);

// TODO: agregar PATCH /orders/:id (cancelacion) cuando el negocio lo permita.
