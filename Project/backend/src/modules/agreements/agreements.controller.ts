import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/asyncHandler.js';
import * as agreementsService from './agreements.service.js';

const targetsSchema = z.object({
  monthlyRecruitmentTarget: z.number().finite().nonnegative(),
  annualRecruitmentTarget: z.number().finite().nonnegative(),
});

const versionSchema = z.object({
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vatRate: z.number().min(0).max(1),
  hqOverheadRate: z.number().min(0).max(1),
  partnerSplitRate: z.number().min(0).max(1),
  meetingQuota: z.number().int().nonnegative(),
  meetingCost: z.number().finite().nonnegative(),
  vehicleCredit: z.number().finite().nonnegative(),
});

export const agreementsRouter = Router();

agreementsRouter.get(
  '/current',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const agreement = await agreementsService.currentAgreement(auth.tenantId);
    res.json(agreement);
  }),
);

agreementsRouter.patch(
  '/targets',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const parsed = targetsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'יעדי הגיוס לא תקינים' });
      return;
    }
    const targets = await agreementsService.updateTargets(auth.tenantId, parsed.data);
    res.json({ targets });
  }),
);

agreementsRouter.post(
  '/versions',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const parsed = versionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'פרטי הגרסה לא תקינים' });
      return;
    }
    const created = await agreementsService.openNewVersion(auth.tenantId, parsed.data);
    res.status(201).json(created);
  }),
);
