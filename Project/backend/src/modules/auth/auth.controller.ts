import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../app/asyncHandler.js';
import { clearSessionCookie, isUuid, readCookie, SESSION_COOKIE, setSessionCookie } from '../../app/cookies.js';
import { jerusalemToday } from '../dashboard/dates.js';
import * as authService from './auth.service.js';

const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\+?[0-9]{9,15}$/)),
  password: z.string().min(8).max(200),
});

export const authRouter = Router();

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'מספר טלפון או סיסמה לא תקינים' });
      return;
    }
    const session = await authService.login(parsed.data.phone, parsed.data.password);
    if (!session) {
      res.status(401).json({ error: 'טלפון או סיסמה שגויים' });
      return;
    }
    setSessionCookie(res, session.sessionId);
    res.json({ phone: session.phone });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const sessionId = readCookie(req, SESSION_COOKIE);
    if (!sessionId || !isUuid(sessionId)) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    await authService.logout(sessionId);
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const sessionId = readCookie(req, SESSION_COOKIE);
    if (!sessionId || !isUuid(sessionId)) {
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    const user = await authService.currentUser(sessionId);
    if (!user) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'נדרשת התחברות' });
      return;
    }
    res.json({ ...user, today: jerusalemToday() });
  }),
);

export const requireAuth = asyncHandler(async (req, res, next) => {
  const sessionId = readCookie(req, SESSION_COOKIE);
  if (!sessionId || !isUuid(sessionId)) {
    res.status(401).json({ error: 'נדרשת התחברות' });
    return;
  }
  const session = await authService.authenticate(sessionId);
  if (!session) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'נדרשת התחברות' });
    return;
  }
  req.auth = { userId: session.userId, tenantId: session.tenantId, sessionId: session.id };
  next();
});
