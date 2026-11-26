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

export async function updateClient(
  tenantId: string,
  clientId: string,
  input: {
    fullName?: string;
    idNumber?: string;
    birthDate?: string | null;
    isBasePortfolio?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
  },
): Promise<ClientView> {
  return withTenantTransaction(tenantId, async (db) => {
    const existing = await clientsModel.findClient(db, clientId);
    if (!existing) {
      throw new DomainError('CLIENT_NOT_FOUND');
    }
    const nextId =
      input.idNumber != null && input.idNumber.trim() !== ''
        ? encryptIdNumber(input.idNumber.trim())
        : {
            iv: existing.idNumberIv,
            ciphertext: existing.idNumberCiphertext,
            authTag: existing.idNumberAuthTag,
          };
    const client = await clientsModel.updateClient(db, clientId, {
      fullName: input.fullName?.trim() ?? existing.fullName,
      idNumberIv: nextId.iv,
      idNumberCiphertext: nextId.ciphertext,
      idNumberAuthTag: nextId.authTag,
      birthDate: input.birthDate !== undefined ? input.birthDate : existing.birthDate,
      isBasePortfolio: input.isBasePortfolio ?? existing.isBasePortfolio,
      status: input.status ?? existing.status,
    });
    return present(client);
  });
}

export async function requireClient(tenantId: string, clientId: string): Promise<clientsModel.ClientRecord> {
  const client = await withTenantTransaction(tenantId, (db) => clientsModel.findClient(db, clientId));
  if (!client) {
    throw new DomainError('CLIENT_NOT_FOUND');
  }
  return client;
}
