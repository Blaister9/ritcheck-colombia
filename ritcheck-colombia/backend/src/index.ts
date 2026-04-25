// ==========================================
// ARCHIVO: backend/src/index.ts
// PROPOSITO: Punto de entrada de la API REST Express
// DEPENDENCIAS: Express, CORS, Helmet, rutas, middlewares
// LLAMADO DESDE: npm run dev/start y Railway
// ==========================================
import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { corsAllowedOrigins, env, isDemoMode } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { healthRouter } from './routes/health.js';
import { ordersRouter } from './routes/orders.js';
import { uploadRouter } from './routes/upload.js';
import { webhookRouter } from './routes/webhook.js';


const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsAllowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin no permitido.'));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Bold-Signature', 'X-Request-Id','x-order-token'],
    credentials: true,
  }),
);
app.use(pinoHttp({ logger }));
app.use(globalRateLimit);

app.use('/api/webhooks', webhookRouter);
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use('/api/health', healthRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/uploads', uploadRouter);
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, demoMode: isDemoMode }, 'RITCheck API listening');
  if (isDemoMode) {
    logger.warn(
      { scope: 'index', demoMode: true },
      'DEMO_MODE activo: POST /api/orders creara ordenes con status=paid sin pasar por Bold',
    );
  }
});

// TODO: agregar graceful shutdown para cerrar Redis/Supabase/colas en Railway.
