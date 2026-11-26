import type { PoolClient } from 'pg';
import { getPool } from './pool.js';

export type Db = PoolClient;

export async function withTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already unusable. The pool discards it on release.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function withTenantTransaction<T>(tenantId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  return withTransaction(async (db) => {
    await db.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    return fn(db);
  });
}

export async function queryRows<T>(db: Db, text: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(text, params as never[]);
  return result.rows as T[];
}
