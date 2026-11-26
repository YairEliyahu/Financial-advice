import { Router } from 'express';
import { asyncHandler } from '../../app/asyncHandler.js';
import { jerusalemYearMonth, type DashboardRange } from './dates.js';
import * as dashboardService from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const requested = req.query.month;
    let year: number;
    let month: number;
    if (requested == null || requested === '') {
      const current = jerusalemYearMonth();
      year = current.year;
      month = current.month;
    } else if (typeof requested === 'string' && /^\d{4}-\d{2}$/.test(requested)) {
      year = Number(requested.slice(0, 4));
      month = Number(requested.slice(5, 7));
      if (month < 1 || month > 12) {
        res.status(400).json({ error: 'חודש לא תקין' });
        return;
      }
    } else {
      res.status(400).json({ error: 'חודש לא תקין' });
      return;
    }
    const requestedRange = req.query.range;
    let range: DashboardRange = 'month';
    if (requestedRange != null && requestedRange !== '') {
      if (requestedRange === 'month' || requestedRange === 'quarter' || requestedRange === 'year') {
        range = requestedRange;
      } else {
        res.status(400).json({ error: 'טווח לא תקין' });
        return;
      }
    }
    const payload = await dashboardService.dashboard(auth.tenantId, year, month, range);
    res.json(payload);
  }),
);
