import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getPool } from '../src/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const sql = await readFile(path.join(here, 'schema.sql'), 'utf8');
  const pool = getPool();
  await pool.query(sql);
  console.log('Schema applied.');
  await closePool();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
