import { asNullableDateString } from '../../db/numbers.js';
import { queryRows, type Db } from '../../db/transaction.js';

export interface ClientRecord {
  id: string;
  fullName: string;
  idNumberIv: string;
  idNumberCiphertext: string;
  idNumberAuthTag: string;
  birthDate: string | null;
  isBasePortfolio: boolean;
  status: string;
}

interface ClientRow {
  id: string;
  full_name: string;
  id_number_iv: string;
  id_number_ciphertext: string;
  id_number_auth_tag: string;
  birth_date: string | null;
  is_base_portfolio: boolean;
  status: string;
}

function mapClient(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    fullName: row.full_name,
    idNumberIv: row.id_number_iv,
    idNumberCiphertext: row.id_number_ciphertext,
    idNumberAuthTag: row.id_number_auth_tag,
    birthDate: asNullableDateString(row.birth_date),
    isBasePortfolio: row.is_base_portfolio,
    status: row.status,
  };
}

export async function listClients(db: Db): Promise<ClientRecord[]> {
  const rows = await queryRows<ClientRow>(
    db,
    `SELECT id, full_name, id_number_iv, id_number_ciphertext, id_number_auth_tag,
            birth_date, is_base_portfolio, status
     FROM clients
     ORDER BY full_name`,
  );
  return rows.map(mapClient);
}

export async function insertClient(
  db: Db,
  tenantId: string,
  input: {
    fullName: string;
    idNumberIv: string;
    idNumberCiphertext: string;
    idNumberAuthTag: string;
    birthDate: string | null;
    isBasePortfolio: boolean;
  },
): Promise<ClientRecord> {
  const rows = await queryRows<ClientRow>(
    db,
    `INSERT INTO clients (
       tenant_id, full_name, id_number_iv, id_number_ciphertext, id_number_auth_tag,
       birth_date, is_base_portfolio, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
     RETURNING id, full_name, id_number_iv, id_number_ciphertext, id_number_auth_tag,
               birth_date, is_base_portfolio, status`,
    [
      tenantId,
      input.fullName,
      input.idNumberIv,
      input.idNumberCiphertext,
      input.idNumberAuthTag,
      input.birthDate,
      input.isBasePortfolio,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('CLIENT_INSERT_FAILED');
  }
  return mapClient(row);
}

export async function updateClient(
  db: Db,
  clientId: string,
  input: {
    fullName: string;
    idNumberIv: string;
    idNumberCiphertext: string;
    idNumberAuthTag: string;
    birthDate: string | null;
    isBasePortfolio: boolean;
    status: string;
  },
): Promise<ClientRecord> {
  const rows = await queryRows<ClientRow>(
    db,
    `UPDATE clients SET
       full_name = $2,
       id_number_iv = $3,
       id_number_ciphertext = $4,
       id_number_auth_tag = $5,
       birth_date = $6,
       is_base_portfolio = $7,
       status = $8
     WHERE id = $1
     RETURNING id, full_name, id_number_iv, id_number_ciphertext, id_number_auth_tag,
               birth_date, is_base_portfolio, status`,
    [
      clientId,
      input.fullName,
      input.idNumberIv,
      input.idNumberCiphertext,
      input.idNumberAuthTag,
      input.birthDate,
      input.isBasePortfolio,
      input.status,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error('CLIENT_UPDATE_FAILED');
  }
  return mapClient(row);
}

export async function findClient(db: Db, clientId: string): Promise<ClientRecord | null> {
  const rows = await queryRows<ClientRow>(
    db,
    `SELECT id, full_name, id_number_iv, id_number_ciphertext, id_number_auth_tag,
            birth_date, is_base_portfolio, status
     FROM clients WHERE id = $1`,
    [clientId],
  );
  const row = rows[0];
  return row ? mapClient(row) : null;
}
