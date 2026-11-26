import { randomUUID } from 'node:crypto';
import { sessionExpiresAt } from '../../app/cookies.js';
import { withTenantTransaction } from '../../db/transaction.js';
import * as authModel from './auth.model.js';
import { hashPassword, normalizePhone, verifyPassword } from './password.js';

let dummyHash: Promise<string> | undefined;

function placeholderHash(): Promise<string> {
  dummyHash ??= hashPassword('shadow-ledger-not-a-real-password');
  return dummyHash;
}

export async function login(phone: string, password: string): Promise<{ sessionId: string; phone: string } | null> {
  const normalized = normalizePhone(phone);
  const user = await authModel.findUserByPhone(normalized);
  const hash = user?.passwordHash ?? (await placeholderHash());
  const matches = await verifyPassword(password, hash);
  if (!user || !matches) {
    return null;
  }
  const sessionId = randomUUID();
  await authModel.insertSession({
    id: sessionId,
    userId: user.id,
    tenantId: user.tenantId,
    expiresAt: sessionExpiresAt(),
  });
  return { sessionId, phone: user.phone };
}

export async function logout(sessionId: string): Promise<void> {
  const session = await authModel.findValidSession(sessionId);
  if (!session) {
    return;
  }
  await authModel.deleteSession(session.id, session.tenantId);
}

export async function currentUser(sessionId: string): Promise<{ userId: string; phone: string } | null> {
  const session = await authModel.findValidSession(sessionId);
  if (!session) {
    return null;
  }
  return withTenantTransaction(session.tenantId, async (db) => {
    const user = await authModel.findUserInTenant(db, session.userId);
    if (!user) {
      return null;
    }
    return { userId: user.id, phone: user.phone };
  });
}

export async function authenticate(sessionId: string): Promise<authModel.SessionRecord | null> {
  return authModel.findValidSession(sessionId);
}
