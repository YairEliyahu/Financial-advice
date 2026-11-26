import { DomainError } from '../../domain/errors.js';
import { withTenantTransaction } from '../../db/transaction.js';
import * as clientsModel from './clients.model.js';
import { decryptIdNumber, encryptIdNumber, maskIdNumber } from './idNumber.js';

export interface ClientView {
  id: string;
  fullName: string;
  idNumberMasked: string;
  birthDate: string | null;
  isBasePortfolio: boolean;
  status: string;
}

function present(client: clientsModel.ClientRecord): ClientView {
  let masked = '••••';
  try {
    masked = maskIdNumber(
      decryptIdNumber({
        iv: client.idNumberIv,
        ciphertext: client.idNumberCiphertext,
        authTag: client.idNumberAuthTag,
      }),
    );
  } catch (error) {
    console.error('Failed to decrypt an id number', error);
  }
  return {
    id: client.id,
    fullName: client.fullName,
    idNumberMasked: masked,
    birthDate: client.birthDate,
    isBasePortfolio: client.isBasePortfolio,
    status: client.status,
  };
}

export async function listClients(tenantId: string): Promise<ClientView[]> {
  const clients = await withTenantTransaction(tenantId, (db) => clientsModel.listClients(db));
  return clients.map(present);
}

export async function createClient(
  tenantId: string,
  input: { fullName: string; idNumber: string; birthDate?: string; isBasePortfolio: boolean },
): Promise<ClientView> {
  const encrypted = encryptIdNumber(input.idNumber.trim());
  const client = await withTenantTransaction(tenantId, (db) =>
    clientsModel.insertClient(db, tenantId, {
      fullName: input.fullName.trim(),
      idNumberIv: encrypted.iv,
      idNumberCiphertext: encrypted.ciphertext,
      idNumberAuthTag: encrypted.authTag,
      birthDate: input.birthDate ?? null,
      isBasePortfolio: input.isBasePortfolio,
    }),
  );
  return present(client);
}

export async function requireClient(tenantId: string, clientId: string): Promise<clientsModel.ClientRecord> {
  const client = await withTenantTransaction(tenantId, (db) => clientsModel.findClient(db, clientId));
  if (!client) {
    throw new DomainError('CLIENT_NOT_FOUND');
  }
  return client;
}
