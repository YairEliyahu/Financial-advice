import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/asyncHandler.js';
import * as clientsService from './clients.service.js';

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  idNumber: z.string().trim().min(4).max(20),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isBasePortfolio: z.boolean(),
});

export const clientsRouter = Router();

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const clients = await clientsService.listClients(auth.tenantId);
    res.json({ clients });
  }),
);

clientsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'פרטי הלקוח לא תקינים' });
      return;
    }
    const client = await clientsService.createClient(auth.tenantId, {
      fullName: parsed.data.fullName,
      idNumber: parsed.data.idNumber,
      isBasePortfolio: parsed.data.isBasePortfolio,
      ...(parsed.data.birthDate != null ? { birthDate: parsed.data.birthDate } : {}),
    });
    res.status(201).json({ client });
  }),
);
