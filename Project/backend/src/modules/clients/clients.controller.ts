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

const updateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    idNumber: z.string().trim().min(4).max(20).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    isBasePortfolio: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });

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

clientsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = updateSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      res.status(400).json({ error: 'פרטי הלקוח לא תקינים' });
      return;
    }
    const client = await clientsService.updateClient(auth.tenantId, id.data, {
      ...(parsed.data.fullName != null ? { fullName: parsed.data.fullName } : {}),
      ...(parsed.data.idNumber != null ? { idNumber: parsed.data.idNumber } : {}),
      ...(parsed.data.birthDate !== undefined ? { birthDate: parsed.data.birthDate } : {}),
      ...(parsed.data.isBasePortfolio != null ? { isBasePortfolio: parsed.data.isBasePortfolio } : {}),
      ...(parsed.data.status != null ? { status: parsed.data.status } : {}),
    });
    res.json({ client });
  }),
);
