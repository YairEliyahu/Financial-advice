import pg from 'pg';

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => value);

const globalForPool = globalThis as typeof globalThis & {
  __shadowLedgerPgPool?: pg.Pool | undefined;
};

export function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  globalForPool.__shadowLedgerPgPool ??= new Pool({
    connectionString,
    // Each warm Vercel isolate keeps this pool. A small cap avoids opening the
    // default 10 connections on every instance. Local `npm run dev` is unchanged.
    ...(process.env.VERCEL === '1' ? { max: 1 } : {}),
  });

  return globalForPool.__shadowLedgerPgPool;
}

export async function closePool(): Promise<void> {
  const pool = globalForPool.__shadowLedgerPgPool;
  if (pool) {
    await pool.end();
    globalForPool.__shadowLedgerPgPool = undefined;
  }
}
