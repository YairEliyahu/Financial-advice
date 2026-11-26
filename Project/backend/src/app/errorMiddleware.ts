import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '../domain/errors.js';
import {
  CalculationBaseRequiredError,
  ProductNotValidForManufacturerError,
} from '../modules/commission/commission.service.js';
import { ManualCommissionRequiredError } from '../modules/commission/commission.rules.js';

const messages: Record<string, { status: number; error: string }> = {
  DEAL_NOT_FOUND: { status: 404, error: 'העסקה לא נמצאה' },
  CLIENT_NOT_FOUND: { status: 404, error: 'הלקוח לא נמצא' },
  MANUFACTURER_NOT_FOUND: { status: 404, error: 'היצרן לא נמצא' },
  NO_AGREEMENT: { status: 422, error: 'אין גרסת הסכם בתוקף לתאריך שנבחר' },
  ALREADY_ABSORBED: { status: 409, error: 'העסקה כבר נקלטה' },
  LOCKED: { status: 409, error: 'עסקה שסומנה כתואמת נעולה' },
  NOT_READY: { status: 409, error: 'צריך לקלוט את העסקה לפני סימון הלימה' },
  VERSION_CONFLICT: { status: 409, error: 'תאריך הגרסה החדשה חייב להיות אחרי תחילת הגרסה הפתוחה' },
};

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof DomainError) {
    const mapped = messages[error.code] ?? { status: 400, error: 'הבקשה לא תקינה' };
    res.status(mapped.status).json({ error: mapped.error });
    return;
  }
  if (error instanceof ProductNotValidForManufacturerError) {
    res.status(422).json({ error: 'המוצר לא תקף ליצרן שנבחר' });
    return;
  }
  if (error instanceof ManualCommissionRequiredError) {
    res.status(422).json({ error: 'חובה להזין סכום עמלה ידני' });
    return;
  }
  if (error instanceof CalculationBaseRequiredError) {
    res.status(422).json({ error: 'חסר בסיס חישוב להפקדות או לפרמיה' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'שגיאת שרת' });
}
