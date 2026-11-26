import pg from 'pg';

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => value);

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  pool ??= new Pool({ connectionString });
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
