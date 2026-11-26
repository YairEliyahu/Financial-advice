import { queryRows, withTenantTransaction, withTransaction, type Db } from '../../db/transaction.js';

export interface UserRecord {
  id: string;
  tenantId: string;
  phone: string;
  passwordHash: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
}

interface UserRow {
  id: string;
  tenant_id: string;
  phone: string;
  password_hash: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  tenant_id: string;
  expires_at: Date;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    phone: row.phone,
    passwordHash: row.password_hash,
  };
}

export async function findUserByPhone(phone: string): Promise<UserRecord | null> {
  return withTransaction(async (db) => {
    await db.query(`SELECT set_config('app.login_phone', $1, true)`, [phone]);
    const rows = await queryRows<UserRow>(
      db,
      `SELECT id, tenant_id, phone, password_hash FROM users WHERE phone = $1`,
      [phone],
    );
    const row = rows[0];
    return row ? mapUser(row) : null;
  });
}

export async function insertSession(input: {
  id: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
}): Promise<void> {
  await withTenantTransaction(input.tenantId, async (db) => {
    await db.query(
      `INSERT INTO sessions (id, user_id, tenant_id, expires_at) VALUES ($1, $2, $3, $4)`,
      [input.id, input.userId, input.tenantId, input.expiresAt.toISOString()],
    );
  });
}

export async function findValidSession(sessionId: string): Promise<SessionRecord | null> {
  return withTransaction(async (db) => {
    await db.query(`SELECT set_config('app.session_id', $1, true)`, [sessionId]);
    const rows = await queryRows<SessionRow>(
      db,
      `SELECT id, user_id, tenant_id, expires_at
       FROM sessions
       WHERE id = $1 AND expires_at > now()`,
      [sessionId],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      expiresAt: row.expires_at,
    };
  });
}

export async function deleteSession(sessionId: string, tenantId: string): Promise<void> {
  await withTenantTransaction(tenantId, async (db) => {
    await db.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
  });
}

export async function findUserInTenant(db: Db, userId: string): Promise<UserRecord | null> {
  const rows = await queryRows<UserRow>(
    db,
    `SELECT id, tenant_id, phone, password_hash FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  return row ? mapUser(row) : null;
}
