import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'sl_session';

function ttlMs(): number {
  const days = Number(process.env.SESSION_TTL_DAYS ?? 365);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 365;
  return safeDays * 24 * 60 * 60 * 1000;
}

export function sessionExpiresAt(): Date {
  return new Date(Date.now() + ttlMs());
}

function sameSite(): CookieOptions['sameSite'] {
  const value = process.env.COOKIE_SAMESITE ?? 'lax';
  if (value === 'none' || value === 'strict' || value === 'lax') {
    return value;
  }
  return 'lax';
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: sameSite(),
    path: '/',
    maxAge: ttlMs(),
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  const parts = header.split(';');
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
}
