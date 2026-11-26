import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/asyncHandler.js';
import { listProducts, PRODUCT_TYPES } from '../commission/catalog.js';
import * as dealsService from './deals.service.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.number().finite().nonnegative();

const previewSchema = z.object({
  manufacturerId: z.string().uuid(),
  productType: z.enum(PRODUCT_TYPES),
  dealDate: dateSchema,
  expectedAmount: money,
  calculationBaseAmount: money.optional(),
  manualAmount: money.optional(),
});

const createSchema = previewSchema.extend({
  clientId: z.string().uuid(),
});

const absorbSchema = z.object({
  actualAmount: money,
  calculationBaseAmount: money.optional(),
  manualAmount: money.optional(),
});

const reconcileSchema = z.object({
  status: z.enum(['MATCHED', 'DISCREPANCY']),
  note: z.string().trim().max(2000).optional(),
});

const patchSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    manufacturerId: z.string().uuid().optional(),
    productType: z.enum(PRODUCT_TYPES).optional(),
    dealDate: dateSchema.optional(),
    expectedAmount: money.optional(),
    calculationBaseAmount: money.nullable().optional(),
    manualAmount: money.nullable().optional(),
    reconciliationStatus: z.enum(['PENDING_REVIEW', 'MATCHED', 'DISCREPANCY']).optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    actualAmount: money.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });

function quoteFrom(data: z.infer<typeof previewSchema>): dealsService.QuoteRequest {
  return {
    productType: data.productType,
    manufacturerId: data.manufacturerId,
    dealDate: data.dealDate,
    aumAmount: data.expectedAmount,
    ...(data.calculationBaseAmount != null ? { calculationBaseAmount: data.calculationBaseAmount } : {}),
    ...(data.manualAmount != null ? { manualAmount: data.manualAmount } : {}),
  };
}

export const dealsRouter = Router();

dealsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const deals = await dealsService.listDeals(auth.tenantId);
    res.json({ deals });
  }),
);

dealsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'פרטי העסקה לא תקינים' });
      return;
    }
    const deal = await dealsService.createDeal(auth.tenantId, {
      ...quoteFrom(parsed.data),
      clientId: parsed.data.clientId,
    });
    res.status(201).json({ deal });
  }),
);

dealsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = patchSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      res.status(400).json({ error: 'פרטי העדכון לא תקינים' });
      return;
    }
    const data = parsed.data;
    const deal = await dealsService.updateDeal(auth.tenantId, id.data, {
      ...(data.clientId != null ? { clientId: data.clientId } : {}),
      ...(data.manufacturerId != null ? { manufacturerId: data.manufacturerId } : {}),
      ...(data.productType != null ? { productType: data.productType } : {}),
      ...(data.dealDate != null ? { dealDate: data.dealDate } : {}),
      ...(data.expectedAmount != null ? { expectedAmount: data.expectedAmount } : {}),
      ...(data.calculationBaseAmount !== undefined ? { calculationBaseAmount: data.calculationBaseAmount } : {}),
      ...(data.manualAmount !== undefined ? { manualAmount: data.manualAmount } : {}),
      ...(data.reconciliationStatus != null ? { reconciliationStatus: data.reconciliationStatus } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.actualAmount != null ? { actualAmount: data.actualAmount } : {}),
    });
    res.json({ deal });
  }),
);

dealsRouter.post(
  '/:id/absorb',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = absorbSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      res.status(400).json({ error: 'סכום הקליטה לא תקין' });
      return;
    }
    const deal = await dealsService.absorbDeal(auth.tenantId, id.data, {
      actualAmount: parsed.data.actualAmount,
      ...(parsed.data.calculationBaseAmount != null
        ? { calculationBaseAmount: parsed.data.calculationBaseAmount }
        : {}),
      ...(parsed.data.manualAmount != null ? { manualAmount: parsed.data.manualAmount } : {}),
    });
    res.json({ deal });
  }),
);

dealsRouter.post(
  '/:id/reconciliation',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const id = z.string().uuid().safeParse(req.params.id);
    const parsed = reconcileSchema.safeParse(req.body);
    if (!id.success || !parsed.success) {
      res.status(400).json({ error: 'סימון ההלימה לא תקין' });
      return;
    }
    if (parsed.data.status === 'DISCREPANCY' && (parsed.data.note ?? '').length === 0) {
      res.status(422).json({ error: 'לפער צריך לכתוב הערה' });
      return;
    }
    const deal = await dealsService.reconcileDeal(auth.tenantId, id.data, {
      status: parsed.data.status,
      note: parsed.data.note ?? null,
    });
    res.json({ deal });
  }),
);

export const commissionRouter = Router();

commissionRouter.get('/products', (_req, res) => {
  res.json({ products: listProducts() });
});

commissionRouter.post(
  '/preview',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'נתוני התצוגה המקדימה לא תקינים' });
      return;
    }
    const preview = await dealsService.preview(auth.tenantId, quoteFrom(parsed.data));
    res.json(preview);
  }),
);
