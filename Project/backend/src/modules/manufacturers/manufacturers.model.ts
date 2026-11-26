import { queryRows, type Db } from '../../db/transaction.js';
import { isManufacturerType, type ManufacturerType } from '../commission/catalog.js';

export interface ManufacturerRecord {
  id: string;
  nameHe: string;
  manufacturerType: ManufacturerType;
}

interface ManufacturerRow {
  id: string;
  name_he: string;
  manufacturer_type: string;
}

function mapManufacturer(row: ManufacturerRow): ManufacturerRecord {
  if (!isManufacturerType(row.manufacturer_type)) {
    throw new Error('UNKNOWN_MANUFACTURER_TYPE');
  }
  return {
    id: row.id,
    nameHe: row.name_he,
    manufacturerType: row.manufacturer_type,
  };
}

export async function listManufacturers(db: Db): Promise<ManufacturerRecord[]> {
  const rows = await queryRows<ManufacturerRow>(
    db,
    `SELECT id, name_he, manufacturer_type FROM manufacturers ORDER BY name_he`,
  );
  return rows.map(mapManufacturer);
}

export async function findManufacturer(db: Db, id: string): Promise<ManufacturerRecord | null> {
  const rows = await queryRows<ManufacturerRow>(
    db,
    `SELECT id, name_he, manufacturer_type FROM manufacturers WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  return row ? mapManufacturer(row) : null;
}

export async function insertManufacturer(
  db: Db,
  tenantId: string,
  input: { nameHe: string; manufacturerType: ManufacturerType },
): Promise<ManufacturerRecord> {
  const rows = await queryRows<ManufacturerRow>(
    db,
    `INSERT INTO manufacturers (id, tenant_id, name_he, manufacturer_type)
     VALUES (gen_random_uuid(), $1, $2, $3)
     RETURNING id, name_he, manufacturer_type`,
    [tenantId, input.nameHe, input.manufacturerType],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('MANUFACTURER_INSERT_FAILED');
  }
  return mapManufacturer(row);
}

export async function updateManufacturerName(db: Db, id: string, nameHe: string): Promise<ManufacturerRecord | null> {
  const rows = await queryRows<ManufacturerRow>(
    db,
    `UPDATE manufacturers SET name_he = $2 WHERE id = $1 RETURNING id, name_he, manufacturer_type`,
    [id, nameHe],
  );
  const row = rows[0];
  return row ? mapManufacturer(row) : null;
}
