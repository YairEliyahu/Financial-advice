import cors from 'cors';
import express from 'express';
import { errorMiddleware } from './errorMiddleware.js';
import { agreementsRouter } from '../modules/agreements/agreements.controller.js';
import { authRouter, requireAuth } from '../modules/auth/auth.controller.js';
import { clientsRouter } from '../modules/clients/clients.controller.js';
import { commissionRouter, dealsRouter } from '../modules/deals/deals.controller.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.controller.js';
import { manufacturersRouter } from '../modules/manufacturers/manufacturers.controller.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/clients', requireAuth, clientsRouter);
  app.use('/api/deals', requireAuth, dealsRouter);
  app.use('/api/commission', requireAuth, commissionRouter);
  app.use('/api/dashboard', requireAuth, dashboardRouter);
  app.use('/api/agreements', requireAuth, agreementsRouter);
  app.use('/api/manufacturers', requireAuth, manufacturersRouter);

  app.use(errorMiddleware);
  return app;
}
