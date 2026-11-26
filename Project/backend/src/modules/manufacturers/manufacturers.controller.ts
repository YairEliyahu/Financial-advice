import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/asyncHandler.js';
import { MANUFACTURER_TYPES } from '../commission/catalog.js';
import * as manufacturersService from './manufacturers.service.js';

const createSchema = z.object({
  nameHe: z.string().trim().min(2).max(80),
  manufacturerType: z.enum(MANUFACTURER_TYPES),
});

const renameSchema = z.object({
  nameHe: z.string().trim().min(2).max(80),
});

export const manufacturersRouter = Router();

manufacturersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const manufacturers = await manufacturersService.listManufacturers(auth.tenantId);
    res.json({ manufacturers });
  }),
);

manufacturersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'פרטי היצרן לא תקינים' });
      return;
    }
    const manufacturer = await manufacturersService.createManufacturer(auth.tenantId, parsed.data);
    res.status(201).json({ manufacturer });
  }),
);

manufacturersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = renameSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      res.status(400).json({ error: 'פרטי היצרן לא תקינים' });
      return;
    }
    const manufacturer = await manufacturersService.renameManufacturer(auth.tenantId, id.data, parsed.data.nameHe);
    res.json({ manufacturer });
  }),
);
