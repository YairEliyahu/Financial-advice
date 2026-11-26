import { DomainError } from '../../domain/errors.js';
import { withTenantTransaction } from '../../db/transaction.js';
import { MANUFACTURER_TYPE_LABELS, type ManufacturerType } from '../commission/catalog.js';
import * as manufacturersModel from './manufacturers.model.js';

export interface ManufacturerView {
  id: string;
  nameHe: string;
  manufacturerType: ManufacturerType;
  manufacturerTypeLabel: string;
}

function present(manufacturer: manufacturersModel.ManufacturerRecord): ManufacturerView {
  return {
    ...manufacturer,
    manufacturerTypeLabel: MANUFACTURER_TYPE_LABELS[manufacturer.manufacturerType],
  };
}

export async function listManufacturers(tenantId: string): Promise<ManufacturerView[]> {
  const rows = await withTenantTransaction(tenantId, (db) => manufacturersModel.listManufacturers(db));
  return rows.map(present);
}

export async function createManufacturer(
  tenantId: string,
  input: { nameHe: string; manufacturerType: ManufacturerType },
): Promise<ManufacturerView> {
  const row = await withTenantTransaction(tenantId, (db) =>
    manufacturersModel.insertManufacturer(db, tenantId, input),
  );
  return present(row);
}

export async function renameManufacturer(tenantId: string, id: string, nameHe: string): Promise<ManufacturerView> {
  const row = await withTenantTransaction(tenantId, (db) => manufacturersModel.updateManufacturerName(db, id, nameHe));
  if (!row) {
    throw new DomainError('MANUFACTURER_NOT_FOUND');
  }
  return present(row);
}
